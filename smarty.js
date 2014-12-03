var fs = require('fs');
var path = require('path');
var read = fs.readFileSync;

var viewsDir;

/**
 * 定界符
 * @type {string}
 */
var left_delimiter = exports.left_delimiter = '{';
var right_delimiter = exports.right_delimiter = '}';
var auto_literal = exports.auto_literal = true;

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

var tags = {
	'extends': {
		type: 'function',
		parse: function(options){
			if(options.file){
				return read(path.join(viewsDir, options.file)).toString();
			}
	}
	}
};

/**
 * 去除左右定界符
 * @param str
 * @returns {*}
 */
function delLeftDelimiter(str){
	return str.replace(exports.left_delimiter, '');
}
function delRightDelimiter(str){
	return str.replace(exports.right_delimiter, '');
}

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
 * 解析tag
 * @param str
 */
function parseTag(str){
	var tagArr = str.match(/^(.\w+)\W/);
	var tag = tags[tagArr[1]];
	var opts = parseTagOpts(tagArr.input, tagArr[1]);
	if(tag){
		if(tag.type == 'function'){
			return tag.parse(opts);
		}
	}
}

/**
 * 解析语法
 * @param str
 */
function findTags(str){
	return str.replace(/\{%[\s\S]*?\S\%}/g, function(a){
		a = delLeftDelimiter(a);
		a = delRightDelimiter(a);
		a = parseTag(a);
		return a || '';
	});
}

/**
 * 解析字符串
 * @type {Function}
 */
var parse = exports.parse = function(str, options){
	str = findTags(str, options);
	console.log('parse',str);
};

/**
 * 编译
 * @type {Function}
 */
var compile = exports.compile = function(str, options){
	parse(str, options);
	return function(locals){
		return locals;
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
		fn = compile(str, options);
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
	// 设置模板文件目录
	viewsDir = options.settings.views;
	try{
		str = options.cache
			? cache[key] || (cache[key] = read(path, 'utf8'))
			: read(path, 'utf8');
	}catch(err){
		fn(err);
		return;
	}

	fn(null, render(str, options));
};
exports.__express = exports.renderFile;
