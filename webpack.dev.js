/* eslint-env node */
/* eslint @typescript-eslint/no-var-requires: "off" */

import path from 'path';
import { merge } from 'webpack-merge';
import common from './webpack.common.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default merge(common, {
    mode: 'development',
    devServer: {
        static: {
            directory: path.join(__dirname, './'),
        },
        compress: true,
        port: 5500,
        hot: true,
        client: {
            overlay: false,
        },
    },
});
