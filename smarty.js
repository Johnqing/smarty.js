var fs = require('fs');
var path = require('path');
var read = fs.readFileSync;

/**
 * 定界符
 * @type {string}
 */
exports.left_delimiter = '{';
exports.right_delimiter = '}';
exports.auto_literal = true;

var dataName = '$data';
/**
 * 运算符
 * @type {{eq: string, ne: string, neq: string, gt: string, lt: string, ge: string, gte: string, le: string, lte: string, and: string, or: string, mod: string, ==: string, ===: string, !=: string, >: string, <: string, >=: string, <=: string, !: string, %: string, (: string, ): string, 0: number, false: boolean, null: null, undefined: null}}
 */
var operators = {
	"eq":	'==',
	"ne":	'!=',
	"neq":	'!=',
	"gt":	'>',
	"lt":	'<',
	"ge":	'>=',
	"gte":	'>=',
	"le":	'<=',
	"lte":	'<=',
	// not:	'!',
	"and":	'&&',
	"or":	'||',
	"mod":	'%',

	'==':	'==',
	'===':	'===',
	'!=':	'!=',
	'>':	'>',
	'<':	'<',
	'>=':	'>=',
	'<=':	'<=',
	'!':	'!',
	'%':	'%',

	'(':	'(',
	')':	')',

	'0':			0,
	'false':		false,

	'null':			null,
	'undefined':	null
};
/**
 * 缓存对象
 * @type {{}}
 */
var cache = {};
var blocks = {};

var tags = {
	'if': {
		type: 'function',
		parse: function(options){
			return '");if('+options+'){strArr.push("'
		}
	},
	'elseif': {
		type: 'function',
		parse: function(options){
			return '");} else if(' +options+ '){strArr.push("';
		}
	},
	'/if': {
		type: 'function',
		parse: function(options){
			return '");};strArr.push("'
		}
	}
};
/**
 * 解析需要的数据
 * @param opts
 * @param name
 * @returns {{}}
 */
function parseTagOpts(opts, name){
	var optString = opts.replace(name, '').replace(/"|'/g, '');
	var optArr = optString.split(' ');
	var item;
	var obj = {};

	for(var i=0, len = optArr.length; i<len; i++){
		item = optArr[i].split('=');
		if(item[0]){
			obj[item[0]] = item[1] || item[0];
		}
	}

	return obj
}
/**
 * html处理
 * @param source
 * @returns {string}
 */
function parseTags(source){
	source = source.replace(/('|"|\\)/g, '\\$1')
		.replace(/\r/g, '\\r')
		.replace(/\n/g, '\\n');
	source = 'strArr.push("' + source + '");';
	return source + '\n';
}

/**
 * 模板编译
 * @param source
 * @returns {string}
 * @private
 */
exports._compile = function _compile(source, options){
	var compileCache;
	var openArr = source.split(exports.left_delimiter),
		tempCode = '';

	var blockName;

	openArr.forEach(function(code){

		function getTagStr(t, tn){
			codeTag = codeTag.replace(/\$/g, dataName + '.');
			var text = t.parse(codeTag.replace(tn, ''));
			if(blockName){
				blocks[blockName] += text + html;
			}else{
				tempCode += parseTags(text);
			}
		}

		var codeArr = code.split(exports.right_delimiter);
		var codeTag = codeArr[0];
		var html = codeArr[1];
		// html
		if(codeArr.length === 1)
			return tempCode += parseTags(codeTag);
		// smarty tag
		var tagName = codeTag.match(/^(.\w+)\W/);

		if(tagName){
			var opts = parseTagOpts(tagName.input, tagName[1]);
			var tag = tags[tagName[1]];

			if(tagName[1] == 'extends'){
				compileCache = read(path.join(options.settings.views, opts.file)).toString();
				return;
			}

			if(tagName[1] == 'block' && blocks[opts.name]){
				tempCode += parseTags(blocks[opts.name]);
				return;
			}

			if(tagName[1] == 'block') {
				blockName = opts.name;
				blocks[blockName] = html;
				return;
			}

			if(tagName[1] == '/block'){
				blockName = '';
			}

			if(tagName[1] == 'include'){
				var text = read(path.join(options.settings.views, opts.file)).toString();
				if(blockName){
					blocks[blockName] += text + html;
				}else{
					tempCode += parseTags(text);
				}
				return;
			}

			if(tag){
				getTagStr(tag, tagName[1]);
			}

		} else if(html) {
			if(tags[codeTag]){
				getTagStr(tags[codeTag], codeTag);
			}
			tempCode += parseTags(html);
			return;
		}

	});
	if(compileCache){
		tempCode = _compile(compileCache);
	}
	return tempCode;
}

/**
 * 解析字符串
 * @type {Function}
 */
var parse = exports.parse = function(str, options){
	var sTmpl = 'var strArr=[]; '+exports._compile(str, options)+'return strArr.join("");';
	return sTmpl;
};

/**
 * 编译
 * @type {Function}
 */
var compile = exports.compile = function(str, options){
	var fnStr = exports.parse(str, options);
	blocks = {};
	var fn;
	try{
		fn = new Function(dataName, fnStr);
	}catch(err){
		throw new Error(err);
	}
	return function(locals){
		return fn.call(this, locals);
	}
}
/**
 * 渲染
 * @type {Function}
 */
var render = exports.render = function(str, options){
	var fn;
	options = options || {};

	if(options.cache){
		if (options.filename) {
			fn = cache[options.filename] || (cache[options.filename] = compile(str, options));
		} else{
			throw new Error('"cache" option requires "filename".');
		}
	} else {
		fn = exports.compile(str, options);
	}
	options.__proto__ = options.locals;
	return fn.call(options.scope, options);
};
/**
 * 入口
 * @param path
 * @param options
 * @param fn
 */
exports.renderFile = function(path, options, fn){
	var key = path + ':string';

	if (typeof options == 'function') {
		fn = options;
		options = {};
	}

	var str;
	options.filename = path;
	try{
		str = options.cache
			? cache[key] || (cache[key] = read(path, 'utf8'))
			: read(path, 'utf8');
	}catch(err){
		fn(err);
		return;
	}

	fn(null, exports.render(str, options));
};
exports.__express = exports.renderFile;