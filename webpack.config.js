const LwcWebpackPlugin = require('lwc-webpack-plugin');
const path = require('path');

module.exports = {
    plugins: [new LwcWebpackPlugin()],
    entry: './popup-src/index.js',
    output: {
        path: path.resolve(__dirname, 'popup'),
        filename: 'bundle.js'
    }
};