import Postmate from 'postmate';

import async_with_timeout from './async_with_timeout';
import { TimeoutError } from './async_with_timeout';


/**
 * @module COMB
 * 
 * @description
 * Parent window
 * ```html
 * <script type="text/javascript" src="./holo_hosting_comb.js"></script>
 * <script type="text/javascript">
 * (async () => {
 *     const child = await comb.connect( url );
 * 
 *     await child.set("mode", mode );
 * 
 *     let response = await child.run("signIn");
 * })();
 * </script>
 * ```
 * 
 * Child frame
 * ```html
 * <script type="text/javascript" src="./holo_hosting_comb.js"></script>
 * <script type="text/javascript">
 * (async () => {
 *     const parent = comb.listen({
 *         "signIn": async function ( ...args ) {
 *             if ( this.mode === DEVELOP )
 *                 ...
 *             else
 *                 ...
 *             return response;
 *         },
 *     });
 * })();
 * </script>
 * ```
 * 
 */


const COMB = {
  /**
   * Turn on debugging and set the logging level.  If 'debug' is not called, the default log level
   * is 'error'.
   * 
   * @function debug
   * 
   * @param {string} level		- Log level (default: "debug", options: "error", "warn", "info", "debug", "trace")
   * 
   * @example
   * COMB.debug( "info" );
   */
  debug(level = 'debug') {
    Postmate.debug = true;
  },

  /**
   * Insert an iframe (pointing at the given URL) into the `document.body` and wait for COMB to
   * connect.
   * 
   * @async
   * @function connect
   * 
   * @param {string} url		- URL that is used as 'src' for the iframe
   * 
   * @return {ChildAPI} Connection to child frame
   * 
   * @example
   * const child = await COMB.connect( "http://localhost:8002" );
   */
  async connect(url, timeout) {
    const child = new ChildAPI(url, timeout);
    await child.connect();
    return child;
  },

  /**
   * Listen to 'postMessage' requests and wait for a parent window to connect.
   * 
   * @async
   * @function listen
   * 
   * @param {object} methods		- Functions that are available for the parent to call.
   * 
   * @return {ParentAPI} Connection to parent window
   * 
   * @example
   * const parent = await COMB.listen({
   *     "hello": async function () {
   *         return "Hello world";
   *     }
   * });
   */
  async listen(methods) {
    const parent = new ParentAPI(methods);
    await parent.connect();
    return parent;
  },
};


class ChildAPI {

  static frame_count: number = 0;

  url: string;
  msg_count: number;
  responses: object;
  msg_bus: any;
  handshake: any;
  class_name: string;
  loaded: boolean;

  /**
   * Initialize a child frame using the given URL.
   * 
   * @class ChildAPI
   * 
   * @param {string} url		- URL that is used as 'src' for the iframe
   * 
   * @prop {string} url 		- iFrame URL
   * @prop {number} msg_count		- Incrementing message ID
   * @prop {object} responses		- Dictionary of request Promises waiting for their responses
   * @prop {object} msg_bus		- Postmate instance
   * @prop {promise} handshake	- Promise that is waiting for connection confirmation
   * @prop {string} class_name	- iFrame's unique class name
   * @prop {boolean} loaded		- Indicates if iFrame successfully loaded
   * 
   * @example
   * const child = new ChildAPI( url );
   * await child.connect();
   * 
   * await child.set("mode", mode );
   * let response = await child.run("signIn");
   */
  constructor(url, timeout = 5_000) {
    this.url = url;
    this.msg_count = 0;
    this.responses = {};
    this.loaded = false;

    this.class_name = "comb-frame-" + ChildAPI.frame_count++;
    this.handshake = async_with_timeout(async () => {
      // log.info("Init Postmate handshake");
      const handshake = new Postmate({
        "container": document.body,
        "url": this.url,
        "classListArray": [this.class_name],
      });

      const iframe = document.querySelector('iframe.' + this.class_name);
      // log.debug("Listening for iFrame load event", iframe );

      iframe['contentWindow'].addEventListener("domcontentloaded", () => {
        // log.debug("iFrame content has loaded");
        this.loaded = true;
      });

      return await handshake;
    }, timeout);
  }

  /**
   * Wait for handshake to complete and then attach response listener.
   * 
   * @async
   * 
   * @return {this}
   * 
   * @example
   * const child = new ChildAPI( url );
   * await child.connect();
   */
  async connect() {
    let child;

    try {
      child = await this.handshake;
    } catch (err) {
      if (err.name === "TimeoutError") {
        if (this.loaded) {
          // log.error("iFrame loaded but could not communicate with COMB");
          throw new TimeoutError("Failed to complete COMB handshake", err.timeout);
        }
        else {
          // log.error("iFrame did not trigger load event");
          throw new TimeoutError("Failed to load iFrame", err.timeout);
        }
      }
      else
        throw err;
    }

    // log.info("Finished handshake");

    child.on('response', (data) => {
      let [k, v] = data;
      // log.info("Received response for msg_id:", k );

      const [f, r] = this.responses[k];

      if (v instanceof Error)
        r(v);
      else
        f(v);

      delete this.responses[k];
    });

    this.msg_bus = child;

    return this;
  }

  /**
   * Internal method that wraps requests in a timeout.
   * 
   * @async
   * @private
   * 
   * @param {string} method		- Internally consistent Postmate method
   * @param {string} name		- Function name or property name
   * @param {*} data			- Variable input that is handled by child API
   * 
   * @return {*} Response from child
   */
  private request(method, name, data, timeout = 2000) {
    let msg_id = this.msg_count++;

    this.msg_bus.call(method, [msg_id, name, data]);
    // log.info("Sent request with msg_id:", msg_id );

    return async_with_timeout(async () => {
      const request = new Promise((f, r) => {
        this.responses[msg_id] = [f, r];
      });

      return await request;
    }, timeout);
  }

  /**
   * Set a property on the child instance and wait for the confirmation. Properties set that way 
   * can be accessed as properties of `this` in the functions passed via listen() to the parentAPI.
   * 
   * Essentially, it is a shortcut to remember some state instead of having to write a method to
   * remember some state.  Example `child.set("development_mode", true)` vs
   * `child.call("setDevelopmentMode", true)`.  The latter requires you to define
   * `setDevelopmentMode` on the child model where the former does not require any
   * pre-configuration.
   * 
   * @async
   * 
   * @param {string} key		- Property name
   * @param {*} value			- Property value
   * 
   * @return {boolean} Success status
   * 
   * @example
   * let success = await child.set( "key", "value" );
   */
  async set(key, value) {
    return await this.request("prop", key, value);
  }

  /**
   * Call an exposed function on the child instance and wait for the response.
   * 
   * @async
   * 
   * @param {string} method		- Name of exposed function to call
   * @param {...*} args		- Arguments that are passed to function
   * 
   * @return {*} 
   * 
   * @example
   * let response = await child.run( "some_method", "argument 1", 2, 3 );
   */
  async run(method, ...args) {
    return await this.request("exec", method, args);
  }

  async call(method, ...args) {
    return await this.request("exec", method, args, 84000000);
  }
}


class ParentAPI {

  listener: any;
  msg_bus: any;
  methods: object;
  properties: object;

  /**
   * Initialize a listening instance and set available methods.
   * 
   * @class ParentAPI
   * 
   * @param {object} methods		- Functions that are available for the parent to call.
   * @param {object} properties	- Properties to memorize in the instance for later use, optional
   * 
   * @prop {promise} listener		- Promise that is waiting for parent to connect
   * @prop {object} msg_bus		- Postmate instance
   * @prop {object} methods		- Method storage
   * @prop {object} properties	- Set properties storage
   * 
   * @example
   * const parent = new ParentAPI({
   *     "hello": async function () {
   *         return "Hello world";
   *     }
   * });
   * await parent.connect();
   */
  constructor(methods, properties = {}) {
    this.methods = methods;
    this.properties = properties;

    this.listener = new Postmate.Model({
      "exec": async (data) => {
        const [msg_id, method, args] = data;

        const fn = this.methods[method];

        if (fn === undefined) {
          // log.error("Method does not exist", method );
          return this.msg_bus.emit("response", [msg_id, new Error("Method '" + method + "' does not exist")]);
        }
        if (typeof fn !== "function") {
          // log.error("Method is not a function: type", typeof fn );
          return this.msg_bus.emit("response", [msg_id, new Error("Method '" + method + "' is not a function. Found type '" + typeof fn + "'")]);
        }

        const resp = await fn.apply(this.properties, args);

        this.msg_bus.emit("response", [msg_id, resp]);
      },
      "prop": async (data) => {
        const [msg_id, key, value] = data;

        this.properties[key] = value;

        this.msg_bus.emit("response", [msg_id, true]);
      }
    });
  }

  /**
   * Wait for parent to connect.
   * 
   * @async
   * 
   * @return {this}
   * 
   * @example
   * const parent = new ParentAPI({
   *     "hello": async function () {
   *         return "Hello world";
   *     }
   * });
   * await parent.connect();
   */
  async connect() {
    this.msg_bus = await this.listener;

    return this;
  }

}

export {
  COMB,
}
