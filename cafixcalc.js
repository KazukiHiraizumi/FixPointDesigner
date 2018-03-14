var FixPoint = function(rc){
	if(arguments.length==0) return;
	rc=rc.trim();
	if(rc=='') return;
	if(rc.charAt(0)=='#') return;

	var delim=new RegExp('[ \\t]','g');
	var tok=rc.split(delim);

	if(tok.length>=1){
		this.reg=tok[0].slice(1);
		this.cmd=tok[0].charAt(0);
	}
	if(tok.length>=2){
		this.sign=tok[1].charAt(0)=='S';
		var an=tok[1].indexOf('.');
		if(an>0){
			this.bit=parseInt(tok[1].slice(1,an));
			this.fp=parseInt(tok[1].slice(an+1));
		}
		else{
			this.bit=parseInt(tok[1].slice(1));
			this.fp=1234;
		}
	}
	if(tok.length>=3){
		this.value=parseFloat(tok[2]);
		this.zval=this.zform(this.value);
	}

	if(this.cmd=='$'){//def
		FixPoint.stack.push(this);
	}
	else if(this.cmd=='@'){//register operation
		if(this.reg=='-'){
			this.quote(FixPoint.reg);
			this.neg();
			this.macro=this.trMacro(FixPoint.reg);
			this.macro+=this.negMacro();
			FixPoint.reg=this;
		}
		else if(this.reg=='<<'){
			this.quote(FixPoint.reg);
			this.shl();
			this.macro+=this.shlMacro();
			FixPoint.reg=this;
		}
		else if(this.reg=='>>'){
			this.quote(FixPoint.reg);
			this.shr();
			this.macro+=this.shrMacro();
			FixPoint.reg=this;
		}
	}
	else if(this.cmd=='>'){//store
		this.quote(FixPoint.reg);
		this.macro=this.trMacro(FixPoint.reg);
		FixPoint.reg=this;
		if(this.reg!=''){
			FixPoint.stack.push(this);
			this.macro+=this.storeMacro();
		}
	}
	else{
		for(var i=FixPoint.stack.length-1;;i--){
			var s=FixPoint.stack[i];
			if(this.reg==s.reg){
				this.quote(s);
				if(this.bit+this.fp!=s.bit+s.fp){
					this.error='Only MSB can quote';
				}
				break;
			}
			else if(i==0){
				return;
			}
		}

		if(this.cmd=='<'){
			this.macro+=this.loadMacro();
			FixPoint.reg=this;
		}
		else if(this.cmd=='*'){
			this.macro+=this.mulMacro(FixPoint.reg);
			FixPoint.reg=this.mul(FixPoint.reg);
		}
		else if(this.cmd=='-'){
			this.macro+=this.subMacro(FixPoint.reg);
			FixPoint.reg=this.sub(FixPoint.reg);
		}
		else if(this.cmd=='+'){
			this.macro+=this.addMacro(this);
			FixPoint.reg=this.add(FixPoint.reg);
		}
	}
}

FixPoint.reg=null;
FixPoint.stack=new Array();

FixPoint.prototype={
	cmd:null, reg:null, value:null, zval:null, sign:null, bit:null, fp:null, macro:'', error:'', //qt:null,
	quote : function(x){
//		this.qt=x;
		this.value=x.value;
		if(this.sign==null){
			this.sign=x.sign;
			this.bit=x.bit;
			this.fp=x.fp;
		}
		else if(this.fp==1234){
			this.fp=x.fp;
		}
		this.zval=this.zform(x.fval());
	},
	format : function(){
		if(this.sign==null) return '';
		else if(arguments.length==0)	return (this.sign? 'S':'U')+this.bit+'.'+this.fp;
		else if(arguments[0]=='type') return (this.sign? 'S':'U')+this.bit;
	},
	zform : function(x){
		var mod=Math.pow(2,this.bit);
		var max=mod-1;
		var min=0;
		if(this.sign){
			max-=mod/2;
			min-=mod/2;
		}

		var fp=Math.pow(2,-this.fp);
		var z=parseInt(x*fp);
		if(z>max){
			this.error='+ over flow';
			return min+(z-max)%mod;
		}
		else if(z<min){
			this.error='- over flow';
			return max-(min-z)%mod;
		}
		else return z;
	},
	fval : function(){
		return this.zval*Math.pow(2,this.fp);
	},
	neg : function(){
		this.sign=true;
		this.value=-this.value;
		this.zval=this.zform(-this.fval());
		return this;
	},
	shl : function(){
		this.value=2*this.value;
		this.zval=this.zform(this.fval()*2);
		return this;
	},
	shr : function(){
		this.value=this.value/2;
		this.zval=this.zform(this.fval()/2);
		return this;
	},
	mul : function(reg){
		var y=new FixPoint();
		y.sign=this.sign||reg.sign;
		y.bit=this.bit+reg.bit;
		y.fp=this.fp+reg.fp;
		y.value=this.value*reg.value;
		y.zval=y.zform(this.fval()*reg.fval());
		return y;
	},
	add : function(reg){
		var y=new FixPoint();
		if(this.bit!=reg.bit || this.fp!=reg.fp){
			this.error='bit width unmatch';
			return y;
		}
		y.sign=reg.sign;
		y.bit=reg.bit;
		y.fp=reg.fp;
		y.value=this.value+reg.value;
		y.zval=y.zform(this.fval()+reg.fval());
		return y;
	},
	sub : function(reg){
		var y=new FixPoint();
		if(this.bit!=reg.bit || this.fp!=reg.fp){
			this.error='bit width unmatch';
			return y;
		}
		y.sign=reg.sign;
		y.bit=reg.bit;
		y.fp=reg.fp;
		y.value=-this.value+reg.value;
		y.zval=y.zform(-this.fval()+reg.fval());
		return y;
	},

	trMacro : function(q){
		var mac='';
		var cbit=q.bit-this.bit;
		console.log(this.bit+'/'+q.bit);
		if(this.sign!=q.sign) mac+='cvs'+q.format('type')+'<br>';
//		if(this.bit==q.bit){
			var n=this.fp-q.fp;
//			if(n>0) mac+='>>'+this.format('type')+' '+n+'<br>';
//			else if(n<0) mac+='<<'+this.format('type')+' '+(-n)+'<br>';
			if(n>0) mac+='>>'+n;
			else if(n<0) mac+='<<'+(-n);
			if(q.bit!=this.bit) mac+='('+q.bit+'&rarr;'+this.bit+')<br>';
			else mac+='<br>'
//		}
//		else if(this.bit+this.fp==q.bit+this.qt.fp){
//		else if(this.bit+this.fp==q.bit+q.fp){
//			if(cbit==8) mac+='trl'+q.bit+'<br>';
//			else if(cbit==-8) mac+='exl'+q.bit+'<br>';
//			else{
//				var f=new FixPoint();
//				f.quote(q);
//				f.bit=cbit>0? this.bit+8:this.bit-8;
//				mac=f.trMacro(q);
//				mac+=this.trMacro(f);
//			}
//		}
//		else if(this.fp==q.fp){
//			if(cbit==8) mac+='trm'+q.format('type')+'<br>';
//			else if(cbit==-8) mac+='exm'+q.format('type')+'<br>';
//			else{
//				var f=new FixPoint();
//				f.quote(q);
//				f.bit=cbit>0? this.bit+8:this.bit-8;
//				mac=f.trMacro(q);
//				mac+=this.trMacro(f);
//			}
//		}
//		else{
//			var f=new FixPoint();
//			f.quote(q);
//			f.sign=this.sign;
//			f.fp=this.fp;
//			mac=f.trMacro(q);
//			mac+=this.trMacro(f);			
//		}
		return mac;
	},
	loadMacro : function(){
//		return 'load_'+this.bit+' '+this.reg;
		return '';
	},
	storeMacro : function(){
//		return 'store_'+this.bit+' '+this.reg;
		return '';
	},
	mulMacro : function(reg){
		return 'mul'+reg.bit+'_'+this.format('type')+' '+this.reg+'<br>';
	},
	addMacro : function(reg){
		return 'add'+reg.bit+' '+this.reg+'<br>';
	},
	subMacro : function(reg){
		return 'sub'+reg.bit+' '+this.reg+'<br>';
	},
	negMacro : function(){
		return 'neg'+this.format('type')+'<br>';
	},
	shlMacro : function(){
		return 'shl'+this.format('type')+' 1<br>';
	},
	shrMacro : function(){
		return 'shr'+this.format('type')+' 1<br>';
	}
}







