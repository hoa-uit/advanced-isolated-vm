# advanced-isolated-vm
This is a work around about importing modules into isolated-vm

isolated-vm only supports run plain javascript code, does not support some specific built in modules (http,buffer,os,fs,..) because it does not contain any libuv in there
Just think isolated-vm like a browser, that you can not import a npm module or use buffer,fs,crypto,... even for console.log >_<

this repo is a example how to deal with that pain point, it will dynamically load modules and import into isolated-vm
