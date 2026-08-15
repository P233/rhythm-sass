const path = require("path");
const sassTrue = require("sass-true");

sassTrue.runSass({ describe, it }, path.resolve(__dirname, "lib.test.scss"));
sassTrue.runSass({ describe, it }, path.resolve(__dirname, "rhythm.test.scss"));
sassTrue.runSass({ describe, it }, path.resolve(__dirname, "metrics.test.scss"));
