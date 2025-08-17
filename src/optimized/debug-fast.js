function createDebug () {
  try {
    if ((typeof process !== 'undefined' && process.env && process.env.DEBUG && process.env.DEBUG.match(/json-rules-engine/)) ||
        (typeof window !== 'undefined' && window.localStorage && window.localStorage.debug && window.localStorage.debug.match(/json-rules-engine/))) {
      return {
        debug: console.debug.bind(console),
        enabled: true
      }
    }
  } catch (ex) {
    // Do nothing
  }
  return {
    debug: () => {},
    enabled: false
  }
}

const debugInfo = createDebug()
export const debug = debugInfo.debug
export const debugEnabled = debugInfo.enabled
export default debug
