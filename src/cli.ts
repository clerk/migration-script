
import * as p from '@clack/prompts'
import color from 'picocolors'


export const runCLI = async () => {
  p.intro(`${color.bgCyan(color.black('Clerk User Migration Utility'))}`)

  const args = await p.group(
    {
      source: () =>
        p.select({
          message: 'What platform are you migrating your users from?',
          initialValue: 'authjs',
          maxItems: 1,
          options: [
            { value: 'authjs', label: 'Auth.js (Next-Auth)' },
            { value: 'auth0', label: 'Auth0' },
            { value: 'supabase', label: 'Supabase' }
          ]
        }),
      file: () =>
        p.text({
          message: 'Specify the file to use for importing your users',
          initialValue: './users.json',
          placeholder: './users.json'
        }),
      instance: () =>
        p.select({
          message: 'Are you importing your users into a production instance? You should only import into a development instance for testing',
          initialValue: 'prod',
          maxItems: 1,
          options: [
            { value: 'prod', label: 'Prodction' },
            { value: 'dev', label: 'Developetion' }
          ]
        }),
      offset: () =>
        p.text({
          message: 'Specify an offset to begin importing from.',
          defaultValue: '0',
          placeholder: '0'
        }),
      begin: () =>
        p.confirm({
          message: 'Begin Migration?',
          initialValue: true,
        }),
    },
    {
      onCancel: () => {
        p.cancel('Migration cancelled.');
        process.exit(0);
      },
    }
  )

  if (args.begin) {
    console.log('Migration started')
  }


  return args

}
