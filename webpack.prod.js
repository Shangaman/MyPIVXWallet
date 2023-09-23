/* eslint-env node */
/* eslint @typescript-eslint/no-var-requires: "off" */

import { merge } from 'webpack-merge';
import common from './webpack.common.js';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
export default merge(common, {
    mode: 'production',
    optimization: {
        // Inject a CSS minimizer alongside the default JS minimizer (the '...' is the inclusion of the default webpack JS minimizer!)
        minimizer: [new CssMinimizerPlugin(), '...'],
    },
});
