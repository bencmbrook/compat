let fs = require('fs')
let colors = require('colors')
let browserslist = require('browserslist')

module.exports.outputErrors = (errors) => {
  const numErrors = Object.getOwnPropertyNames(errors).length
  if (numErrors > 0) {
    Object.keys(errors).forEach((fileName) => {
      const numFileErrors = Object.getOwnPropertyNames(errors[fileName]).length
      const fileErrors = errors[fileName]
      const fileContents = fs.readFileSync(fileName, 'utf8')
      const maxRange = fileContents.length - 1
      console.log(colors.bold(colors.underline(fileName) + '": ') + colors.red(numFileErrors + ' errors'))
      Object.keys(fileErrors).forEach((fileErrorKey) => {
        const error = fileErrors[fileErrorKey]
        if (error.error === 'featureUndefined') {
          console.log(colors.blue('undefined feature: ' + fileErrorKey))
        } else if (error.error === 'parse') {
          console.log(colors.red('parse error: ' + error.msg))
        } else if (error.error === 'incompatibility') {
          const incompatEnvString = error.incompatEnvs.join(', ')
          const partialEnvString = error.partialEnvs.join(', ')

          if (incompatEnvString.length > 0 || partialEnvString.length > 0) {
            console.log(colors.bold('  feature: ') + fileErrorKey)
            if (incompatEnvString.length > 0) {
              console.log(colors.red(colors.bold('    incompatible: ') + incompatEnvString))
            }
            if (partialEnvString.length > 0) {
              console.log(colors.yellow(colors.bold('    partial:      ') + partialEnvString))
            }

            error.features.forEach((feature) => {
              if (feature.loc !== undefined) {
                console.log(colors.bold('    ' + 'on line ' + colors.underline(feature.loc.start.line) + ':'))
              }
              if (feature.range.length === 2) {
                console.log(indentString(fileContents.slice(feature.range[0], feature.range[1]), 6))
              } else if (feature.range.length === 1) {
                console.log(indentString(fileContents.slice(feature.range[0], Math.min(feature.range[0] + 20, maxRange)), 6))
              }
            })
          }
        }
      })
    })
  }
}

module.exports.outputCoverage = (jsEnvs, htmlEnvs, errors) => {
  let incompatibleEnvs = [];
  Object.entries(errors).forEach(([fileName, errorsForFile]) => {
    Object.entries(errorsForFile).forEach(([featureName, errorDetails]) => {
      if (errorDetails.incompatEnvs) {
        incompatibleEnvs = [...incompatibleEnvs, ...errorDetails.incompatEnvs];
      }
    })
  })
  const incompatible = new Set(incompatibleEnvs)
  const tested = new Set([...jsEnvs, ...htmlEnvs])
  const differencer = (set1, set2) => new Set([...set1].filter(x => !set2.has(x)))
  const compatible = differencer(tested, incompatible);

  const getBrowserAndVersion = (env) => {
    const [browser, version] = env.split(/(\d+)/);
    return {
      browser,
      version: Number(version),
    };
  };

  const coverage = (() => {
    const maximumIncompatible = {};
    incompatible.forEach((env) => {
      const { browser, version } = getBrowserAndVersion(env);
      if (!maximumIncompatible[browser] || maximumIncompatible[browser] < version) {
        maximumIncompatible[browser] = version;
      }
    });

    let browserslistInput = 'defaults';
    Object.entries(maximumIncompatible).forEach(([browser, version]) => {
      browserslistInput = `${browserslistInput}, not ${browser} <= ${version}`;
    });

    return browserslist.coverage(browserslist(browserslistInput));
  })();

  // Get minimum requirements
  const minimumRequirements = {};
  compatible.forEach((env) => {
    const { browser, version } = getBrowserAndVersion(env);
    if (!minimumRequirements[browser] || minimumRequirements[browser] > version) {
      minimumRequirements[browser] = version;
    }
  });

  console.log('Minimum Requirements:', minimumRequirements)
  console.log('Coverage:', coverage);
}

module.exports.outputSupportedFeatures = (allFeatures) => {
  console.log(colors.bold('Supported Features: '))
  outputSupportedFeaturesTree(allFeatures, 1)
}

function outputSupportedFeaturesTree (node, level) {
  const indentation = Array(level * 2 + 1).join(' ')
  Object.keys(node).forEach((key) => {
    const child = node[key]
    if (child.type === undefined) {
      console.log(colors.bold(indentation + key))
      outputSupportedFeaturesTree(child, level + 1)
    } else {
      console.log(indentation + child.type)
    }
  })
}

module.exports.outputSupportedFeatureGroups = (featureGroupMap) => {
  console.log(colors.bold('Supported Feature Groups: '))
  Object.keys(featureGroupMap).forEach((featureGroupType) => {
    const featureGroupTypeObj = featureGroupMap[featureGroupType]
    console.log(colors.bold('  ' + featureGroupType))
    Object.keys(featureGroupTypeObj).forEach((featureGroupName) => {
      const featureGroup = featureGroupTypeObj[featureGroupName]
      console.log('    ' + featureGroupName)
      featureGroup.forEach((feature) => {
        console.log('      ' + feature.type)
      })
    })
  })
}

module.exports.outputEnabledFeatures = (enabledFeatures) => {
  console.log(colors.bold('Enabled Features: '))
  Object.keys(enabledFeatures).forEach((featureType) => {
    console.log(colors.bold('  ' + featureType))
    const features = enabledFeatures[featureType]
    features.forEach((feature) => {
      console.log('    ' + feature.type)
    })
  })
}

module.exports.outputSupportedEnvs = (supportedEnvs) => {
  console.log(colors.bold('Supported Envs: '))

  console.log(colors.bold('  JS: '))
  supportedEnvs.jsEnvs.forEach((envId) => {
    console.log('    ' + envId)
  })

  console.log(colors.bold('  HTML: '))
  supportedEnvs.htmlEnvs.forEach((envId) => {
    console.log('    ' + envId)
  })
}

module.exports.outputUndefinedEnvs = (undefinedEnvs) => {
  undefinedEnvs.forEach((envId) => {
    console.log(colors.red('Environment "' + envId + '" is not defined. Ignoring.'))
  })
}

module.exports.outputNonExistentTargets = (nonExistentTargets) => {
  nonExistentTargets.forEach((targetPath) => {
    console.log(colors.red('Target "' + targetPath + '" does not exist. Ignoring.'))
  })
}

function indentString (string, spaces) {
  return Array(spaces + 1).join(' ') + string.split('\n').join('\n' + Array(spaces + 1).join(' '))
}
