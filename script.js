(function() {
    var toInject = 
       // Hurr durr javascript
'(' + function() {

/// Only way to communicate between the background script and content script apparently
function getCookie(cookie) { // https://stackoverflow.com/a/19971550/934239
  return document.cookie.split(';').reduce(function(prev, c) {
    var arr = c.split('=');
    return (arr[0].trim() === cookie) ? arr[1] : prev;
  }, undefined);
}

function delete_cookie( name ) {
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

const fuckingsCookieName = 'Fuckings-To-The-Internet';

const enabled = getCookie(fuckingsCookieName) !== 'nofuck';
delete_cookie(fuckingsCookieName);

if (!enabled) {
    console.warn('anti-devtools disabled in this tab');
    return;
}
const isFingerprint = (window.location.hostname.indexOf("fingerprintjs.com") != -1 || window.location.hostname.indexOf("fpjs.io") != -1);
if (isFingerprint) {
    localStorage.removeItem('_vid');
    delete_cookie('_vid');
}

//////////////////////////////////////////////
////////////////////////// begin actual script
//////////////////////////////////////////////


/////////////////////
// For generating consistent randomness
// We get consistent randomness in a time window of ten minutes
//

function simpleHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
        h = Math.imul(31, h) + str.charCodeAt(i);
        h %= 4294967295;
    }
    return h;
}

var LCG=s=>()=>(2**31-1&(s=Math.imul(48271,s)))/2**31;
const date = new Date();

// Decided against using the window.location because some inject code
// to run in about:blank (or another host and get the value back),
// which would make this moot
const hourlySeed = simpleHash((isFingerprint ? Math.random() : '') + date.toDateString() + date.getHours().toString() + Math.floor(date.getMinutes() / 6).toString());
var hourlyRandom = LCG(hourlySeed);


/////////////////////
// Avoid detection of devtools being open
//

var orig_debug = console.debug;
var orig_info = console.info;
var orig_log = console.log;
var orig_warn = console.warn;
var orig_dir = console.dir;

// Devtools tries to do introspection, so defuse these
function checkForProperty(argument, property) {
    var idProperties = Object.getOwnPropertyDescriptor(argument, property);
    // I'm not sure if this is a good idea, but whatever
    if (idProperties !== undefined && 'get' in idProperties && typeof idProperties['get'] === 'function') {
        return true;
    }
    return false;
}

// Avoid timing attacks on the console.* functions
function sleep (dur){
    var t0 = performance.now();
    while(performance.now() < t0 + dur){ /* do nothing */ }
}
var sleepDuration = 1

function saferPrint(argument, originalFunction) {
    var t0 = performance.now();

    // Defuse the toString() trick
    if (typeof argument === 'object' && argument !== null) {
        if (checkForProperty(argument, 'id') || checkForProperty(argument, 'nodeType')) {
            return;
        }
    } else if (typeof argument === 'string') {
        argument = argument.trim();
    }

    // Just in case there's some other clever tricks, do this every time
    try {
        if (typeof argument === 'object' && argument !== null) {
            var props = Object.getOwnPropertyNames(argument);
            for (var i=0; i<props.length; i++) {
                var dummy = argument[props[i]];
            }
        }

        originalFunction(argument);
    } catch(e) {}

    // Defuse timing attacks
    // By default it will sleep about 1ms, but it adjusts to the time it
    // takes to print to the console
    var t1 = performance.now();
    var duration = t1 - t0;
    sleepDuration = Math.max(sleepDuration, duration);
    sleep(sleepDuration - duration);
}

console.debug = function(argument) { saferPrint(argument, orig_debug); }
console.info = function(argument) { saferPrint(argument, orig_info); }
console.log = function(argument) { saferPrint(argument, orig_log); }
console.warn = function(argument) { saferPrint(argument, orig_warn); }
console.dir = function(argument) { saferPrint(argument, orig_dir); }

// We don't want them to hide stuff from us
console.clear = function() { }

// Just in case
window.console.debug = console.debug
window.console.info = console.info
window.console.log = console.log
window.console.warn = console.warn
window.console.clear = console.clear
window.console.dir = console.dir


/////////////////////
// Defuse a bunch of dumb APIs
navigator.getBattery = () => undefined
navigator.getBattery.toString = () => "function getBattery() { [native code] }"

window.devicePixelRatio = 1
window.screen = {}
window.screen.colorDepth = 24
navigator.doNotTrack = undefined


/////////////////////
// Audio stuff is used for fingerprinting, just disable the whole thing
window.OfflineAudioContext = undefined
window.AudioContext = undefined


/////////////////////
// Anonymize a bunch of properties
function setGet(obj, propertyName, func) {
    try {
        Object.defineProperty(obj, propertyName, { get: func })
    } catch (exception) {
        console.log("Failed to override getter (we probably got ran after the ublock helper): " + exception)
    }
}

// Disable overriding
function setSet(obj, propertyName, func) {
    try {
        Object.defineProperty(obj, propertyName, { set: func })
    } catch (exception) {
        console.log("Failed to override getter (we probably got ran after the ublock helper): " + exception)
    }
}

Object.defineProperty(webkitSpeechRecognition.prototype, 'onresult', {
        set: function() { console.log("tried to do speech recognition");  }
    }
)

function setVal(obj, propertyName, func) {
    try {
        Object.defineProperty(obj, propertyName, { value: func })
    } catch (exception) {
        console.log("Failed to override value: " + exception)
    }
}

/////////////////////
// Beacons are dumb
navigator.sendBeacon = function(url, data) { console.log("Intercepted beacon to '" + url + "' with data '" + data + "'"); return true; }
navigator.sendBeacon.toString = () => "function sendBeacon() { [native code] }";

////////////////////
// Generally dumb shit

function setProp(obj, propertyName, val) {
    setGet(obj, propertyName, () => val)
}

setProp(NetworkInformation.prototype, 'downlink',  1000)
setProp(NetworkInformation.prototype, 'effectiveType',  '4g')
setProp(NetworkInformation.prototype, 'rtt',  0)
setProp(NetworkInformation.prototype, 'saveData',  true)

setProp(navigator.credentials, 'get', function() { return 'no'; })

setProp(navigator, 'hardwareConcurrency', 1)

setProp(navigator, 'userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.70 Safari/537.36')
setProp(navigator, 'languages', ['en-US', 'en'])
setProp(navigator, 'platform', 'Win64')
setProp(document, 'referrer', location.protocol + '://' + location.hostname)
setProp(navigator, 'appVersion', '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.70 Safari/537.36')

setProp(UserActivation.prototype, 'isActive', false)
setProp(UserActivation.prototype, 'hasBeenActive', false)


/////////////////////
// Don't allow locking the keyboard
try {
    Keyboard.prototype.lock = function(keys) {
        console.log("Tried to lock keyboard: " + keys)
        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                resolve();
            }, 300);
        });
    }
} catch(e) {
    console.log("Failed to override keyboard locking: " + e)
}

const orig_addEventListener = window.addEventListener;
setProp(window, 'addEventListener', function(type, listener, options) {
        if (type == 'beforeunload') {
            console.log('denied listener before unload', listener);
            return;
        }
        return orig_addEventListener(type, listener, options);
    }
);

///////////////////////////////////
// Nuke the 'are you sure you want to leave' if I haven't interacted with the page
var hasInteracted = false;
window.addEventListener('click', function() { hasInteracted = true; } , true);

var warnUnload = false;
window.onbeforeunload = function(e) {
    if (hasInteracted && warnUnload) {
        console.log('has interacted, allowing warning about unloading page');
        return 'Allow warning';
    }
}

setSet(window, 'onbeforeunload', function() {
    warnUnload = true;
})


/////////////////////
// Protect clipboard

// TODO: return promise that sends request to background script
// which shows a popup for each request.
const orig_clipboardRead = navigator.clipboard.read;
navigator.clipboard.read = function() {
    console.log("Clipboard read");
    console.log(this);
    console.log(arguments);
    orig_clipboardRead.apply(this, arguments);

    //return new Promise() {
    //    setTimeout(function() {
    //        resolve('foo');
    //    }, 300);
    //}
}

const orig_clipboardReadText = navigator.clipboard.readText;
navigator.clipboard.readText = function() {
    console.log("Clipboard read text");
    console.log(this);
    console.log(arguments);
    orig_clipboardReadText.apply(this, arguments);

    //return new Promise() {
    //    setTimeout(function() {
    //        resolve('foo');
    //    }, 300);
    //}
}

const orig_clipboardWrite = navigator.clipboard.write;
navigator.clipboard.write = function(content) {
    console.log("Clipboard write");
    console.log(this);
    console.log(arguments);
    const context = this;
    sleep(500);
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            orig_clipboardWrite.call(this, content).then(function() {
                resolve();
            });
        }, hourlyRandom() * 250 + 250);// stop tricks with quickly replacing clipboard contents
    });
}

const orig_clipboardWriteText = navigator.clipboard.writeText;
navigator.clipboard.writeText = function(text) {
    console.log("Clipboard write text");
    console.log(this);
    console.log(arguments);
    sleep(500);
    const context = this;
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            orig_clipboardWriteText.call(context, text).then(function() {
                resolve();
            });
        }, Math.random() * 250 + 250);// stop tricks with quickly replacing clipboard contents, this will make sure they are replaced in the wrong order (probably), or at least delayed
    });
}

const orig_execCommand = document.execCommand
document.execCommand = function()
{
    var isCopy = false;
    var isCut = false;
    var isPaste = false;
    for (var i=0; i<arguments.length; i++) {
        if (arguments[i] == "copy") {
            isCopy = true;
            continue;
        }
        if (arguments[i] == "cut") {
            isCut = true;
            continue;
        }
        if (arguments[i] == "paste") {
            isPaste = true;
            continue;
        }
    }
    if (isCopy) {
        console.log("is copy");
        sleep(Math.random() * 250 + 250);
        const ret = orig_execCommand.apply(this, arguments)
        console.log(ret);
        //return ret;
    }
    if (isCut) {
        console.log("is cut");
        sleep(Math.random() * 250 + 250);
        const ret = orig_execCommand.apply(this, arguments)
        console.log(ret);
        //return ret;
    }
    if (isPaste) {
        console.log("is paste");
        //const ret = orig_execCommand.apply(this, arguments)
        return false;
    }
    console.log(arguments); console.log(this);
    const ret = orig_execCommand.apply(this, arguments)
    console.log("was not clipboard");
    console.log(ret);
    return ret;
}


//////////////////////////
// Date time anonymization

const orig_resolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions
Intl.DateTimeFormat.prototype.resolvedOptions = function() {
    var ret = orig_resolvedOptions.apply(this, arguments)
    ret.timeZone = "UTC"
    return ret
}
Date.prototype.getTimezoneOffset = function() { return 0; }

function dumpBuf(result) {
    var buf = new Int8Array(result)
    var decoded = ""
    var valid = true
    for (var i=0; i<Math.min(buf.length, 1024); i++) {
        if ((buf[i] < 32 || buf[i] > 126) && buf[i] != 9 && buf[i] != 10 && buf[i] != 13) {
            decoded += "\\x" + buf[i].toString(16)
            valid = false;
            continue;
        }

        decoded += String.fromCharCode(buf[i])
    }

    console.log(decoded)
    if (!valid) {
        console.log(result)
    }
}


///////////////
// Kill crypto

const orig_random = Crypto.prototype.getRandomValues
var notRandomArrayValue = 0
Crypto.prototype.getRandomValues = function(arr) {
    for (var i=0; i<arr.length; i++) {
        arr[i] = notRandomArrayValue++
    }
    return arr;
}

const orig_decrypt = SubtleCrypto.prototype.decrypt
SubtleCrypto.prototype.decrypt = function(algorithm, key, data) {
    var crypt = this
    return new Promise(function(resolve, reject) {
        orig_decrypt.call(crypt, algorithm, key, data).then(
            function(result) {
                console.log("decrypted")
                dumpBuf(result)
                resolve(result);
            }
        )
    });
}
const orig_encrypt = SubtleCrypto.prototype.encrypt
SubtleCrypto.prototype.encrypt = function(algorithm, key, data) {
    console.log("encrypting")
    dumpBuf(data)
    var crypt = this
    return new Promise(function(resolve, reject) {
        orig_encrypt.call(crypt, algorithm, key, data).then(
            function(result) {
                resolve(result);
            }
        )
    });
}

SubtleCrypto.prototype.verify = function(algorithm, key, signature, data) {
    console.log("Trying to verify some shit, alg " + algorithm.name + " hash name " + algorithm.hash.name);
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            console.log("Of course it's ok, you can trust the client")
            resolve(true);
        }, 1000);
    });
}

/////////////////////
// Checking outerWidth is what people do to check if the devtools pane is open, so fuck that up
// And while we're at it, fuck up fingerprinting that rely on the window size (some crash with this)
const orig_innerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth')['get']
const orig_innerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')['get']

const innerWidthRandomness = hourlyRandom()
const innerHeightRandomness = hourlyRandom()
setGet(window, "innerWidth", function () { return orig_innerWidth() + innerWidthRandomness; });
setGet(window, "innerHeight", function () { return orig_innerHeight() + innerHeightRandomness; });

const widthRandomness = hourlyRandom()
const heightRandomness = hourlyRandom()
function fakeWidth() { return window.innerWidth + widthRandomness; }
function fakeHeight() { return window.innerHeight + heightRandomness; }

setGet(window.screen, "availWidth", fakeWidth);
setGet(window.screen, "width", fakeWidth);
setGet(window, "outerWidth", fakeWidth);

setGet(window.screen, "availHeight", fakeHeight);
setGet(window.screen, "height", fakeHeight);
setGet(window, "outerHeight", fakeHeight);


/////////////////////
// Since noone seem to get canvas fingerprinting avoidance right, do it ourselves
// We need to get consistent noise for each instance,
// which is one way fingerprinting code detects other anti-canvas
// fingerprinting extensions
const shift = {
    'r': Math.floor(hourlyRandom() * 10) - 5,
    'g': Math.floor(hourlyRandom() * 10) - 5,
    'b': Math.floor(hourlyRandom() * 10) - 5,
    'a': Math.floor(hourlyRandom() * 10) - 5
};

function garbleImage(image, width, height) {
    for (let row = 0; row < height; row += 3) {
        for (let col = 0; col < width; col += 3) {
            const index = ((row * (width * 4)) + (col * 4));
            image.data[index + 0] = image.data[index + 0] + shift.r;
            image.data[index + 1] = image.data[index + 1] + shift.g;
            image.data[index + 2] = image.data[index + 2] + shift.b;
            image.data[index + 3] = image.data[index + 3] + shift.a;
        }
    }
}
const orig_getImageData = CanvasRenderingContext2D.prototype.getImageData;

// to make sure the js never sees that we fuck with it,
// we restore the contents after generating whatever it wants
// Other extensions that try to break canvas fingerprinting are
// detected because the fingerprinting code makes sure the canvas
// content doesn't get modified
var canvasContentBackup

function garbleCanvas(canvas) {
    const {width, height} = canvas
    const context = canvas.getContext('2d')
    const image = orig_getImageData.call(context, 0, 0, width, height)

    // not sure if we need to do this, or if we can reuse the image,
    // but javascript is slow crap anyways so fuck performance
    canvasContentBackup = orig_getImageData.call(context, 0, 0, width, height)
    garbleImage(image, width, height)

    context.putImageData(image, 0, 0);
}

function ungarbleCanvas(canvas) {
    const context = canvas.getContext('2d');
    context.putImageData(canvasContentBackup, 0, 0);
    canvasContentBackup = undefined
}

const orig_toBlob = HTMLCanvasElement.prototype.toBlob;
Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    value: function() {
        garbleCanvas(this)
        const ret = orig_toBlob.apply(this, arguments)
        ungarbleCanvas(this)
        return ret
    }
});

const orig_toDataURL = HTMLCanvasElement.prototype.toDataURL;
Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: function() {
        garbleCanvas(this)
        const ret = orig_toDataURL.apply(this, arguments);
        ungarbleCanvas(this)
        return ret
    }
});

Object.defineProperty(CanvasRenderingContext2D.prototype, 'getImageData', {
    value: function() {
        ret = orig_getImageData.apply(this, arguments);
        garbleImage(ret, this.canvas.width, this.canvas.height)
        return ret
    }
});


/////////////////////
// fucking webgl is hard to get rid of
delete window.WebGLActiveInfo
delete window.WebGLBuffer
delete window.WebGLContextEvent
delete window.WebGLFramebuffer
delete window.WebGLProgram
delete window.WebGLQuery
delete window.WebGLRenderbuffer
delete window.WebGLSampler
delete window.WebGLShader
delete window.WebGLShaderPrecisionFormat
delete window.WebGLSync
delete window.WebGLTexture
delete window.WebGLTransformFeedback
delete window.WebGLUniformLocation
delete window.WebGLVertexArrayObject

const glVendors = [
    'Microsoft',
    'NVIDIA Corporation',
    'Intel Open Source Technology Center',
    'Google Inc.',
    'Intel Inc.',
    'Brian Paul',
    'Apple Inc.',
    'ATI Technologies Inc.'

]

// Some others I haven't bothered find out where belongs
// Gallium 0.4 on NVE7
// Intel(R) HD Graphics
// ATI Radeon HD Verde XT Prototype OpenGL Engine
const glRenderers = {
    'Microsoft': ['Microsoft Basic Render Driver'],
    'Brian Paul': ['Brian Paul'],
    'NVIDIA Corporation': [
        'NVIDIA GeForce GT 650M OpenGL Engine',
        'NVIDIA GeForce GTX 775M OpenGL Engine',
        'NVIDIA GeForce GT 625 (OEM)'
    ],
    'Apple Inc.': [
        'Apple A9 GPU',
        'PowerVR SGX 535',
        'PowerVR SGX 543'
    ],
    'Intel Inc.': [
        'Intel Iris Pro OpenGL Engine'
    ],
    'Intel Open Source Technology Center': [
        'Mesa DRI Intel(R) HD Graphics 630 (Kaby Lake GT2)',
        'Mesa DRI Intel(R) Iris 6100 (Broadwell GT3)',
        'Mesa DRI Intel(R) HD Graphics 520 (Skylake GT2)',
        'Mesa DRI Intel(R) HD Graphics 615 (Kaby Lake GT2)',
        'Mesa DRI Intel(R) Iris 6100 (Broadwell GT3)'
    ],
    'Google Inc.': [
        'ANGLE (Intel(R) HD Graphics 4600 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce GTX 1050 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce GTX 770 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) HD Graphics Family Direct3D9Ex vs_3_0 ps_3_0)',
        'ANGLE (NVIDIA GeForce GTX 950 Direct3D9Ex vs_3_0 ps_3_0)',
        'ANGLE (Intel(R) HD Graphics 4600 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) HD Graphics Family Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) HD Graphics 4600 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce GTX 960 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) HD Graphics Family Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) HD Graphics 5300 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) HD Graphics 4000 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (ATI Radeon HD 3450 Direct3D9Ex vs_3_0 ps_3_0)',
        'ANGLE (Intel(R) HD Graphics 4000 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) HD Graphics 4600 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) HD Graphics 3000 Direct3D11 vs_4_1 ps_4_1)',
        'ANGLE (Intel(R) HD Graphics 4000 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce GT 750M Direct3D11 vs_5_0 ps_5_0',
        'ANGLE (Intel(R) HD Graphics P4600/P4700 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) G45/G43 Express Chipset (Microsoft Corporation - WDDM 1.1) Direct3D9Ex vs_3_0 ps_3_0)',
        'ANGLE (Intel(R) HD Graphics Family Direct3D9Ex vs_3_0 ps_3_0)',
        'ANGLE (Intel(R) HD Graphics 520 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) HD Graphics 5500 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) HD Graphics 530 Direct3D11 vs_5_0 ps_5_0)',
        'Google SwiftShader'
    ],
    'ATI Technologies Inc.': [
        'AMD Radeon Pro 460 OpenGL Engine',
        'AMD Radeon R9 M370X OpenGL Engine',
    ]
}

const glVendor = glVendors[Math.floor(hourlyRandom() * glVendors.length)]
const glRenderer = glRenderers[glVendor][Math.floor(hourlyRandom() * glRenderers[glVendor].length)]

const orig_gl2GetGetExtension = WebGL2RenderingContext.prototype.getExtension;
const orig_gl2GetParameter = WebGL2RenderingContext.prototype.getParameter;
Object.defineProperty(WebGL2RenderingContext.prototype, 'getParameter', {
    value: function(name) {
        const debugInfo = orig_gl2GetGetExtension.call(this, 'WEBGL_debug_renderer_info');
        if (name == debugInfo.UNMASKED_VENDOR_WEBGL) {
            return glVendor
        }
        if (name == debugInfo.UNMASKED_RENDERER_WEBGL) {
            return glRenderer
        }
        return orig_gl2GetParameter.apply(this, arguments);
    }
});

//Object.defineProperty(WebGL2RenderingContext.prototype, 'getExtension', {
//    value: function(prop) {
//        console.log(prop)
//        return orig_gl2GetGetExtension.apply(this, arguments);
//    }
//});


const orig_glGetGetExtension = WebGLRenderingContext.prototype.getExtension;
const orig_glGetParameter = WebGLRenderingContext.prototype.getParameter;
Object.defineProperty(WebGLRenderingContext.prototype, 'getParameter', {
    value: function(name) {
        const debugInfo = orig_glGetGetExtension.call(this, 'WEBGL_debug_renderer_info');
        if (name == debugInfo.UNMASKED_VENDOR_WEBGL) {
            return glVendor
        }
        if (name == debugInfo.UNMASKED_RENDERER_WEBGL) {
            return glRenderer
        }
        return orig_glGetParameter.apply(this, arguments);
    }
});

//Object.defineProperty(WebGLRenderingContext.prototype, 'getExtension', {
//    value: function(name) {
//        console.log("getExtension, " + name)
//        return orig_glGetGetExtension.apply(this, arguments);
//    }
//});

console.log("devtools detect stuff overriden")

////////////////////////////////////////////
////////////////////////// end actual script
////////////////////////////////////////////
} + ')();' ;


// Create temporary element
var element = document.createElement('script');
element.textContent = toInject
element.async = false


// Inject and then delete
document.documentElement.insertBefore(element, document.documentElement.firstElement)
if (element.parentNode) {
    element.parentNode.removeChild(element);
}

})();
