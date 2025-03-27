# advanced-isolated-vm
This is a work around about importing modules into isolated-vm

- isolated-vm only supports run plain javascript code, does not support some specific built in modules (http,buffer,os,fs,..) because it does not contain any libuv in there
- Just think isolated-vm like a browser, that you can not import a npm module or use buffer,fs,crypto,... even for console.log >_<
- But it's not really like a browser, when you try to bundle npm module and inject into isolated-vm, for some built in module like buffer, fs, ... will cause the error, you can use some kind of tools like webpack, esbuild or browerify to polyfill them, but it will change the behavior of nodejs built in function, it's also not an ideal way

this repo is a example how to deal with that pain point, it will dynamically load modules and import into isolated-vm
