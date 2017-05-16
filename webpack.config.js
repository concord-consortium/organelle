var CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'app': './src/app.js',
  },
  output: {
    path: __dirname + "/dist",
    filename: "organelle.js",
    library: 'Organelle'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015']
        }
      },
      {
        // See https://github.com/adobe-webplatform/Snap.svg/issues/341
        test: require.resolve('snapsvg'),
        loader: 'imports-loader?this=>window,fix=>module.exports=0'
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
