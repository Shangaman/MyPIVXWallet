/* eslint-env node */
/* eslint @typescript-eslint/no-var-requires: "off" */

import path from 'path';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

export default {
    entry: './scripts/index.js',
    output: {
        path: path.resolve(dirname(fileURLToPath(import.meta.url)), './dist'),
        filename: './mpw.js',
        library: 'MPW',
        libraryTarget: 'var',
        clean: true,
    },
    devtool: 'source-map',
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
            },
            {
                test: /\.(jpe?g|png|gif|svg|mp3|svg)$/i,
                type: 'asset/resource',
            },
        ],
    },
    resolve: {
        alias: {
            'bn.js': path.join(
                dirname(fileURLToPath(import.meta.url)),
                'node_modules/bn.js/lib/bn.js'
            ),
        },
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './index.template.html',
            filename: 'index.html',
            favicon: './assets/favicon.ico',
            meta: {
                viewport:
                    'width=device-width, initial-scale=1, shrink-to-fit=no',
            },
        }),
        // Polyfill for non web libraries
        new NodePolyfillPlugin(),
        // Prevents non styled flashing on load
        new MiniCssExtractPlugin(),
        // Make jquery available globally
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery',
            'window.jQuery': 'jquery',
        }),
        // Ignore non english bip39 wordlists
        new webpack.IgnorePlugin({
            resourceRegExp: /^\.\/wordlists\/(?!english)/,
            contextRegExp: /bip39\/src$/,
        }),
        // Copy static web-facing files
        new CopyPlugin({
            patterns: [
                { from: 'manifest.json' },
                { from: 'assets/icons' },
                { from: 'assets/logo_opaque-dark-bg.png' },
                { from: 'scripts/native-worker.js' },
            ],
        }),
    ],
};
