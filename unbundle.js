class Bundle {
    constructor(cbor_buf) {
        let cbor = this.cbor = CBOR.decode(cbor_buf);
        this.magic = toStr(this.cbor[0]);
        this.sections = this.createSections();
        this.index = this.createIndex();
        this.responses = this.createResponses();
        this.entries = this.createEntries();
    }

    createSections() {
        let section_offsets = CBOR.decode(toArrayBuffer(this.cbor[1]));
        // Sort sections in ascending order of offset
        let sorted_section_offsets =
            Array.from(section_offsets).sort((a, b) => a[1][0] - b[1][0]);
        let sections = new Map();
        let i = 0;
        for (let [name, _] of sorted_section_offsets)
            sections.set(name, this.cbor[2][i++]);
        return sections;
    }

    createIndex() {
        let index = new Map();
        for (let [key, val] of this.sections.get('index'))
            index.set(this.convertHeaders(key), {offset: val[0], length: val[1]});
        return index;
    }

    createResponses() {
        return this.sections.get('responses').map((resp) => {
            let [headers, payload] = resp;
            return {headers: this.convertHeaders(CBOR.decode(toArrayBuffer(headers))), payload}
        });
    }

    createEntries() {
        // Sort indices in ascending order of offset
        let sorted_indices = Array.from(this.index).sort((a, b) => a[1].offset - b[1].offset);
        let entries = [];
        for (let i = 0; i < sorted_indices.length; i++)
            entries.push({requestHeaders: sorted_indices[i][0],
                          responseHeaders: this.responses[i].headers,
                          payload: this.responses[i].payload});
        return entries;
    }

    // Map<bytes, bytes> => Map<string, string>
    convertHeaders(headers) {
        let h = new Map();
        for (let [key, val] of headers)
            h.set(toStr(key), toStr(val));
        return h;
    }
}

let toArrayBuffer = (view) =>
    view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);

let toStr = (array) =>
    new TextDecoder("utf-8").decode(array)

// Loader --------------------------------

async function onDrop(file) {
    let buf = await readFileAsArrayBuffer(file);
    let bundle = new Bundle(buf);
    window.bundle = bundle;
    await populateCache(file.name, bundle.entries);
    let main_resource_url = bundle.entries[0].requestHeaders.get(':url');
    await open(main_resource_url);
}

async function populateCache(name, entries) {
    let cache = await caches.open(name);
    let seen = new Set();
    for (let entry of entries) {
        let request = createRequest(entry);
        // Skip if this request is already seen (just to work-around
        // dup'ed entries for HAR-generated bundles).
        if (seen.has(request.url))
            continue;
        seen.add(request.url);
        if (request.method !== 'GET')
            continue;
        await cache.put(request, createResponse(entry));
    }
}

function createRequest(entry) {
    let headers = new Headers();
    for (let [name, value] of entry.requestHeaders) {
        if (name[0] != ':')
            headers.set(name, value);
    }
    return new Request(entry.requestHeaders.get(':url'), {
        method: entry.requestHeaders.get(':method'),
        headers
    });
}

function createResponse(entry) {
    let headers = new Headers();
    for (let [name, value] of entry.responseHeaders) {
        if (name[0] != ':')
            headers.set(name, value);
    }

    // Default to 200 if status is not given.
    let status = entry.responseHeaders.get(':status');
    if (status == null || status == undefined || status == 0)
        status = 200;

    // Response body must be null if status are one of 101, 204, 205 or 304.
    if (status == 101 || status == 204 || status == 205 || status == 304)
        entry.payload = null;

    // Responses with Vary: '*' cannot be put into Cache.
    let vary = headers.get('vary');
    if (vary) {
        let varies = vary.split(',');
        let index = varies.indexOf('*');
        if (index > -1)
            varies.splice(index, 1);
        headers.set('vary', varies.join(','));
    }

    return new Response(entry.payload, {
        status: status,
        headers
    });
}

async function open(url) {
    let frame = document.createElement('iframe');
    frame.src = `loadMainResource?url=${url}`;
    document.getElementById('drop-area').hidden = true;
    document.body.appendChild(frame);
}

function readFileAsArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => { resolve(reader.result); };
        reader.onerror = () => { reject(reader.error); };
        reader.readAsArrayBuffer(blob);
    });
}

document.getElementById('drop-area').addEventListener('drop', (e) => {
    e.stopPropagation();
    e.preventDefault();
    for (let file of e.dataTransfer.files) {
        onDrop(file);
    }
});

navigator.serviceWorker.register('sw.js');
