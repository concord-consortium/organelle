var CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = function(env, argv) {
  const isDevMode = argv.mode !== 'production';
  return {
    entry: {
      'app': './src/app.js',
    },
    output: {
      path: __dirname + "/dist",
      filename: "organelle.js",
      library: 'Organelle',
      libraryExport: 'default'
    },
    devtool: isDevMode ? 'eval-source-map' : 'source-map',
    devServer: {
      contentBase: './dist'
    },
    performance: { hints: false },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
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
  }
};
