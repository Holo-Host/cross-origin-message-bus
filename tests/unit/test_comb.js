const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const fs				= require('fs');
const assert				= require('assert');
const axios				= require('axios');
const expect				= require('chai').expect;

const comb				= require('../../build/index.js');


describe("Testing COMB", () => {
	
    it('should insert Chaperon iframe into hApp window', async () => {
    });
    
});
