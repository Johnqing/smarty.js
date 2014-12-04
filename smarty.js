var fs = require('fs');
var path = require('path');
var read = fs.readFileSync;

var viewsDir;

/**
 * 定界符
 * @type {string}
 */
exports.left_delimiter = '{';
exports.right_delimiter = '}';
exports.auto_literal = true;

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
var _extends = '';
var temp = {};
var input;
var tagsRegx = new RegExp(exports.left_delimiter+'[\\s\\S]*?\\S'+exports.right_delimiter, 'g');

var tags = {
	'block': {
		type: 'function',
		parse: function(options){
			temp = options || {};
		}
	},
	'/block': {
		type: 'function',
		parse: function(options){
			blocks[temp.name] = input.substring(temp.postion, options.postion);
			delete temp;
		}
	},
	'extends': {
		type: 'function',
		parse: function(options){
			if(options.file){
				_extends = read(path.join(viewsDir, options.file)).toString();
			}
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
 * 提取参数
 * @param str
 * @returns {{tag: *, opts: {}}}
 */
function parseParam(str, pos){
	var s = str.replace(exports.left_delimiter, '').replace(exports.right_delimiter, '');
	var tagArr = s.match(/^(.\w+)\W/);
	var tagName = !tagArr ? s : tagArr[1];
	var tag = tags[tagName];
	var opts = !tagArr ? {} : parseTagOpts(tagArr.input, tagName);
	opts.postion = !tagArr ?  pos : (pos + str.length);

	return {
		tag: tag,
		name: tagName,
		opts: opts
	}
}

/**
 * 解析tag
 * @param str
 */
function parseTag(str, pos){
	var param = parseParam(str, pos);
	if(param.tag){
		if(param.tag.type == 'function'){
			param.tag.parse(param.opts)
		}
	}
}
/**
 * 替换extends内的block
 * @param str
 */
function replaceBlock(str){
	var param = parseParam(str, 0);
	var tagId= param.opts.name;

	if(tagId){
		if(blocks[tagId]){
			return blocks[tagId];
		}
	}

};


/**
 * 解析语法
 * @param str
 */
function findTags(str){
	input = str.replace(/\r\n/g, '');
	input.replace(tagsRegx, function(a, pos){
		parseTag(a, pos);
	});
	_extends = _extends.replace(tagsRegx, function(a){
		return replaceBlock(a) || '';
	});

	var sTmpl = 'var strArr=[]; strArr.push('+_extends+')return strArr.join("");';
	return sTmpl;
}

/**
 * 解析字符串
 * @type {Function}
 */
var parse = exports.parse = function(str, options){
	return findTags(str, options);
};

/**
 * 编译
 * @type {Function}
 */
var compile = exports.compile = function(str, options){
	var fnStr = '(function(data){' +
		parse(str, options)
	+'})($data);';

	var fn = new Function('$data', fnStr);

	return function(locals){
		return fn(locals);
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
