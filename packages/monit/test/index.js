const createZero = require("@stream-toolbox/zero");
const createNull = require("@stream-toolbox/null");
const createMonit = require("@stream-toolbox/monit");

const readable = createZero(25 * 2 ** 20);
const writable = createNull(5 * 2 ** 20);
const monit = createMonit();

readable.pipe(monit).pipe(writable);
