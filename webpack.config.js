var CopyWebpackPlugin = require('copy-webpack-plugin');

const path = require('path');

module.exports = [
  'source-map'
].map(devtool => ({
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'organelle.js',
    library: "Organelle",
    libraryTarget: "umd"
  },
  devtool,
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {from: __dirname + '/public'},
        {from: __dirname + '/models', to: 'models'}
      ]
    })
  ],
  node: {
    Buffer: false,
    process: false
  }
}));
