import nyxb from '@nyxb/eslint-config'

export default nyxb(
   {
      rules: {
         'no-console': 0,
         'node/prefer-global/process': 0,
      },
   },
)
