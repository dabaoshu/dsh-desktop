const packageJson = require('./package.json')

module.exports = {
  ...packageJson.build,
  appId: 'ai.autocad.desktop.dev',
  productName: 'autoCad AI Dev',
  directories: {
    ...packageJson.build.directories,
    output: 'dist-dev'
  },
  extraMetadata: {
    name: 'autocad-ai-dev',
    productName: 'autoCad AI Dev',
    dshDesktopChannel: 'development'
  },
  artifactName: 'autocad-ai-dev-${os}-${arch}.${ext}',
  nsis: {
    ...packageJson.build.nsis,
    artifactName: 'autocad-ai-dev-windows-${arch}-setup.${ext}'
  },
  publish: null
}
