let lunr = require('lunr');
let process = require('process');
let stdout = process.stdout;

let index = lunr(function() {
    this.ref('status_id');
    this.field('author');
    this.field('full_text');

    this.add({
        status_id: 'https://twitter.com/hoelzro/status/890551057708969984',
        author: 'hoelzro',
        full_text: "I'm always happy to share knowledge about text processing, shell tips & tricks, Git arcana, C & Lua, and low level Linux stuff!"
    });
});
stdout.write('var savedIndexData =\n');
stdout.write(JSON.stringify(index) + ';');
