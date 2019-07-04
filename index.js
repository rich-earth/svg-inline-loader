var simpleHTMLTokenizer = require('simple-html-tokenizer');
var tokenize = simpleHTMLTokenizer.tokenize;
var generate = simpleHTMLTokenizer.generate;
var loaderUtils = require('loader-utils');
var assign = require('object-assign');
var minisvguri = require('mini-svg-data-uri');
var conditions = require('./lib/conditions');
var transformer = require('./lib/transformer');

// TODO: find better parser/tokenizer
var regexSequences = [
    // Remove XML stuffs and comments
    [/<\?xml[\s\S]*?>/gi, ""],
    [/<!doctype[\s\S]*?>/gi, ""],
    [/<!--.*-->/gi, ""],

    // SVG XML -> HTML5
    [/\<([A-Za-z]+)([^\>]*)\/\>/g, "<$1$2></$1>"], // convert self-closing XML SVG nodes to explicitly closed HTML5 SVG nodes
    [/\s+/g, " "],                                 // replace whitespace sequences with a single space
    [/\> \</g, "><"]                               // remove whitespace between tags
];

function getExtractedSVG(svgStr, query) {
    var config;
    // interpolate hashes in classPrefix
    if(!!query) {
        config = assign({}, query);

        if (!!config.classPrefix) {
            const name = config.classPrefix === true ? '__[hash:base64:7]__' : config.classPrefix;
            config.classPrefix = loaderUtils.interpolateName({}, name, { content: svgStr });
        }

        if (!!config.idPrefix) {
            const id_name = config.idPrefix === true ? '__[hash:base64:7]__' : config.idPrefix;
            config.idPrefix = loaderUtils.interpolateName({}, id_name, { content: svgStr });
        }
    }

    // Clean-up XML crusts like comments and doctype, etc.
    var tokens;
    var cleanedUp = regexSequences.reduce(function (prev, regexSequence) {
        return ''.replace.apply(prev, regexSequence);
    }, svgStr).trim();

    // Tokenize and filter attributes using `simpleHTMLTokenizer.tokenize(source)`.
    try {
        tokens = tokenize(cleanedUp);
    } catch (e) {
        // If tokenization has failed, return earlier with cleaned-up string
        console.warn('svg-inline-loader: Tokenization has failed, please check SVG is correct.');
        return cleanedUp;
    }

    // If the token is <svg> start-tag, then remove width and height attributes.
    var svgStr = generate(transformer.runTransform(tokens, config));

    //if using mini-svg-data-uri, use it
    if(query.miniUri)
      svgStr = minisvguri(svgStr)

    return svgStr;
}

function SVGInlineLoader(content) {
    this.cacheable && this.cacheable();
    this.value = content;
    // Configuration
    var query = loaderUtils.parseQuery(this.query);

    return "module.exports = " + JSON.stringify(getExtractedSVG(content, query));
}

/**
 * Converts mini-svg-uri back to normal chars.
 *
 * Eg:
 * %3csvg version='1.2'
 * into
 * <svg version='1.2'
 *
 * @param {String} str htmlSet entities
 **/
function decodeMinified(str)
{
    str = str.replace("data:image/svg+xml,","");
    str = decodeURI(str);
    str = str.replace(/%2c/g,","); // commas dont get decoded for some reason

    return str;
}


SVGInlineLoader.getExtractedSVG = getExtractedSVG;
SVGInlineLoader.conditions = conditions;
SVGInlineLoader.regexSequences = regexSequences;
SVGInlineLoader.decodeMinified = decodeMinified;

module.exports = SVGInlineLoader;
