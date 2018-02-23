var CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'app': './src/app.js',
  },
  output: {
    path: __dirname + "/lib",
    filename: "organelle.js",
    libraryTarget: "umd",
    library: 'Organelle'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015'],
          plugins: ["transform-object-rest-spread"]
        }
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin([
      {from: __dirname + '/public'},
      {from: __dirname + '/models', to: 'models'}
    ])
  ]
};
