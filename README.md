A proof-of-concept [webbundle](https://wicg.github.io/webpackage/draft-yasskin-wpack-bundled-exchanges.html) loader.

## Demo
https://bundle-load-test.surge.sh/

## How it works
- Installs a Service Worker so that resources can be served from Cache Storage.
- When a webbundle file is dropped, it extracts request / response pairs from the bundle, and puts them into the Cache Storage.
- Then, it creates an iframe whose content is `<base href="main_resource_url"> + main_resource_content`, assuming that the first resource in the bundle is the main resource.

## Acknowledgements
This demo is using cbor.js, a JavaScript implementation of CBOR format by Patrick Gansterer. https://github.com/paroga/cbor-js
