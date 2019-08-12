import svelte from 'rollup-plugin-svelte'
import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import livereload from 'rollup-plugin-livereload'

export default [
  {
    input: 'src/app.js',
    output: {
      file: 'public/bundle.js',
      format: 'iife'
    },
    plugins: [
      svelte({
        include: 'src/**/*.svelte',
        generate: 'dom',
        hydratable: true,
        css: function (css) {
          css.write('public/bundle.css')
        }
      }),
      resolve(),
      commonjs(),
      livereload()
    ]
  },
  {
    input: 'src/admin.js',
    output: {
      file: 'public/adminbundle.js',
      format: 'iife'
    },
    plugins: [
      svelte({
        include: 'src/**/*.svelte',
        generate: 'dom',
        hydratable: true,
        css: function (css) {
          css.write('public/adminbundle.css')
        }
      }),
      resolve(),
      commonjs()
    ]
  }
]
