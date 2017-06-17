const nodeExternals = require('webpack-node-externals')
const DotEnvEmitter = require('./dotenv-emitter')

module.exports = {
    entry: {
        get: './lambdas/src/public/get.js'
    },
    target: 'node',
    module: {
        loaders: [
            {
                test: /\.js$/,
                loaders: [ 'babel-loader' ],
                exclude: /node_modules/,
            }
        ]
    },
    output: {
        libraryTarget: 'commonjs',
        path: 'build',
        filename: 'public/[name].js'
    },
    externals: [ nodeExternals() ],
    plugins: [
        new DotEnvEmitter({
            env: require(DotEnvEmitter.envfiles('local')),
            root: __dirname
        })
    ]
};
