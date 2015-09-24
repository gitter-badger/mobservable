var mobservable = require('mobservable');
var m = mobservable;

var value = mobservable.value;
var voidObserver = function(){};

function buffer() {
    var b = [];
    var res = function(newValue) {
        b.push(newValue);
    };
    res.toArray = function() {
        return b;
    }
    return res;
}


exports.testIsReactive = function(test) {
    function Order(price) {

    }

    function ReactiveOrder(price) {
        m.extendReactive(this, {
            price: price
        });
    }
    test.equal(m.isReactive(null), false);
    test.equal(m.isReactive(null), false);

    test.equal(m.isReactive(m([])), true);
    test.equal(m.isReactive(m({})), true);
    test.equal(m.isReactive(m(function() {})), true);

    test.equal(m.isReactive([]), false);
    test.equal(m.isReactive({}), false);
    test.equal(m.isReactive(function() {}), false);

    test.equal(m.isReactive(new Order()), false);
    test.equal(m.isReactive(m(new Order())), true);

    test.equal(m.isReactive(new ReactiveOrder), true);
    test.equal(m.isReactive(m(3)), true);

    var obj = {};
    test.equal(m.isReactive(obj), false);

    test.equal(m.isReactive(m(function(){})), true);
    test.equal(m.isReactive(m.sideEffect(function(){})), true);

    test.done();

}

exports.testIsComponentReactive = function(test) {
    var component = mobservable.reactiveComponent({ render: function() {}});
    test.equal(m.isReactive(component), false); // dependencies not known yet
    component.componentWillMount();
    component.render();
    test.ok(m.isReactive(component), true);

    test.done();
}

exports.makeReactive1 = function(test) {
    test.throws(function() {
        m(function(a,b) {});
    });

    // recursive structure
    var x = m({
        a: {
            b: {
                c: 3
            }
        }
    });
    var b = buffer();
    m.sideEffect(function() {
        b(x.a.b.c)
    });
    x.a = { b : { c : 4 }};
    x.a.b.c = 5; // new structure was reactive as well
    test.deepEqual(b.toArray(), [3, 4, 5]);

    // recursive structure, but asReference passed in
    test.equal(m.isReactive(x.a.b), true);
    var x2 = m({
        a: m.asReference({
            b: {
                c: 3
            }
        })
    });

    test.equal(m.isReactive(x2), true);
    test.equal(m.isReactive(x2.a), false);
    test.equal(m.isReactive(x2.a.b), false);

    var b2 = buffer();
    m.sideEffect(function() {
        b2(x2.a.b.c)
    });
    x2.a = { b : { c : 4 }};
    x2.a.b.c = 5; // not picked up, not reactive, since passed as reference
    test.deepEqual(b2.toArray(), [3, 4]);

    // non recursive structure
    var x3 = m({
        a: {
            b: {
                c: 3
            }
        }
    }, { recurse: false });
    var b3 = buffer();
    m.sideEffect(function() {
        b3(x3.a.b.c)
    });
    x3.a = { b : { c : 4 }};
    x3.a.b.c = 5; // sub structure not reactive
    test.deepEqual(b3.toArray(), [3, 4]);

    test.done();
}

exports.makeReactive3 = function(test) {
    function Order(price) {
        this.price = price;
    }

    var x = m({
        orders: [new Order(1), new Order(2)]
    });

    var b = buffer();
    m.sideEffect(function() {
        b(x.orders.length);
    });

    test.equal(m.isReactive(x.orders), true);
    test.equal(m.isReactive(x.orders[0]), false);
    x.orders[2] = new Order(3);
    x.orders = [];
    test.equal(m.isReactive(x.orders), true);
    x.orders[0] = new Order(2);
    test.deepEqual(b.toArray(), [2, 3, 0, 1]);

    test.done();
}

exports.makeReactive4 = function(test) {
    var x = m([
        { x : 1 },
        { x : 2 }
    ]);

    var b = buffer();
    m(function() {
        return x.map(function(d) { return d.x });
    }).observe(b, true);

    x[0].x = 3;
    x.shift();
    x.push({ x : 5 });
    test.deepEqual(b.toArray(), [[1,2], [3,2], [2], [2, 5]]);

    // non recursive
    var x2 = m([
        { x : 1 },
        { x : 2 }
    ], { recurse: false });

    var b2 = buffer();
    m(function() {
        return x2.map(function(d) { return d.x });
    }).observe(b2, true);

    x2[0].x = 3;
    x2.shift();
    x2.push({ x : 5 });
    test.deepEqual(b2.toArray(), [[1,2], [2], [2, 5]]);

    test.done();
}


exports.makeReactive5 = function(test) {

    var x = m(function() { });
    test.throws(function() {
        x(7); // set not allowed
    });

    var f = function() {};
    var x2 = m(f, { as: 'reference' });
    test.equal(x2(), f);
    x2(null); // allowed

    var x3 = m(m.asReference(f));
    test.equal(x3(), f);
    x3(null); // allowed

    f = function() { return this.price };

    debugger;
    var x = m({
        price : 17,
        reactive: f,
        nonReactive: m.asReference(f)
    });

    var b = buffer();
    m.sideEffect(function() {
        b([x.reactive, x.nonReactive, x.nonReactive()]);
    });

    x.price = 18;
    var three = function() { return 3; }
    x.nonReactive = three;
    test.deepEqual(b.toArray(), [[17, f, 17], [18, f, 18], [18, three, 3]]);

    test.done();
};


exports.test_as_structure = function(test) {
    
    var x = m.makeReactive({
        x: m.asStructure(null)
    });
    
    var changed = 0;
    var dis = m.observe(function() {
        changed++;
        JSON.stringify(x);
    });
    
    function c() {
        test.equal(changed, 1, "expected a change");
        changed = 0;
    }

    function nc() {
        test.equal(changed, 0, "expected no change");
        changed = 0;
    }
    
    // nc = no change, c = changed.
    c();
    x.x = null;
    nc();
    x.x = undefined;
    c();
    x.x = 3;
    c();
    x.x = 1* x.x;
    nc();
    x.x = "3";
    c();

    x.x = {
        y: 3
    };
    c();
    x.x.y = 3;
    nc();
    x.x = {
        y: 3
    };
    nc();
    x.x = {
        y: 4
    };
    c();
    x.x = {
        y: 3
    };
    c();
    x.x = {
        y: {
            y: 3
        }
    };
    c();
    x.x.y.y = 3;
    nc();
    x.x.y = { y: 3 };
    nc();
    x.x = { y: { y: 3 }};
    nc();
    x.x = { y: { y: 4 }};
    c();
    x.x = {};
    c();
    x.x = {};
    nc();

    x.x = [];
    c();
    x.x = [];
    nc();
    x.x = [3,2,1];
    c();
    x.x.sort();
    c();
    x.x.sort();
    c(); // But.., Ideally, no change here ..! nc();
    x.x[1] = 2;
    nc();
    x.x[0] = 0;
    c();
    x.x[1] = {
        a: [1,2]
    };
    c();
    x.x[1].a = [1,2];
    nc();
    x.x[1].a[1] = 3;
    c();
    x.x[1].a[2] = 3;
    c();
    x.x = {
        a : [ {
            b : 3
        }]
    };
    c();
    x.x = {
        a : [ {
            b : 3
        }]
    };
    nc();
    x.x.a = [{ b : 3 }]
    nc();
    x.x.a[0] = { b: 3 };
    nc();
    x.x.a[0].b = 3;
    nc();
    
    dis();
    test.done();
};

exports.test_as_structure_view = function(test) {
    var x = m.makeReactive({
        a: 1,
        aa: 1,
        b: function() {
            this.a;
            return { a: this.aa };
        },
        c: m.asStructure(function() {
            this.b
            return { a : this.aa };
        })
    });

    var bc = 0;
    var bo = m.observe(function() {
        x.b;
        bc++;
    });
    test.equal(bc, 1);
    
    var cc = 0;
    var co = m.observe(function() {
        x.c;
        cc++;
    });
    test.equal(cc, 1);

    x.a = 2;
    x.a = 3;
    test.equal(bc, 3);
    test.equal(cc, 1);
    x.aa = 3;
    test.equal(bc, 4);
    test.equal(cc, 2);
    test.done();
};