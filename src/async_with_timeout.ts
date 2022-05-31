class TimeoutError extends Error {
  timeout: number

  constructor (message: string, timeout: number) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(message)

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TimeoutError)
    }

    this.name = 'TimeoutError'
    this.timeout = timeout
  }
}

function async_with_timeout<O> (fn: () => Promise<O>, timeout = 2000): Promise<O> {
  return new Promise(async (f, r) => {
    const to_id = setTimeout(() => {
      r(new TimeoutError('Waited for ' + timeout / 1000 + ' seconds', timeout))
    }, timeout)

    try {
      const result = await fn()
      f(result)
    } catch (err) {
      r(err)
    } finally {
      clearTimeout(to_id)
    }
  })
}

export default async_with_timeout
export { TimeoutError }
