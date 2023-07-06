// NOTE: I've made it quickly in es5 style as it's a test project. For real games I use es6/ts. 

var Logic = pc.createScript('logic');
Logic.attributes.add("hero", {
    type: "entity",
    description: "Current entity is used by default.",
});
Logic.attributes.add("swipePositions", {
    type: "vec3",
    description: "",
    default: [[-10, 0, 0], [0, 0, 0], [10, 0, 0]],
    array: true,
});
Logic.attributes.add("swipeThreshold", {
    type: "number",
    description: "Min mouse dragging value to start swipe.",
    default: 10,
});
Logic.attributes.add("isMouseReleaseOnEachSwipeNeeded", {
    type: "boolean",
    description: "",
    default: !false,
});
Logic.attributes.add("world", {
    type: "entity",
    description: "Entity to move, and to reset y to 0 on any collision.",
});
Logic.attributes.add("worldVelocity", {
    type: "vec3",
    description: "",
    placeholder: "m/s",
    default: [0, -10, 0],
});

// initialize code called once per entity
Logic.prototype.initialize = function() {
    if (!this.hero) {
        this.hero = this.entity;
    }

    // State
    this.vec3 = new pc.Vec3();
    this.initialWorldLocPos = this.world ? this.world.getLocalPosition().clone() : pc.Vec3.ZERO;
    this.mouseDownPos = null;
    // Get current swipe-position
    if (this.hero) {
        const pos = this.hero.getPosition();
        const dists = this.swipePositions.map((p, i) => pos.distance(p));
        const minDist = dists.reduce((res, cur) => res == null || res > cur ? cur : res);
        this.posIndex = dists.indexOf(minDist);
        this.hero.setPosition(this.swipePositions[this.posIndex]);
    }
    this.isInTransition = false;
    // this.swipeAxis = this.swipePositions.some((sp) => sp.x ? "x" : (sp.y ? "y": (sp.z ? "z": null)));

    // Apply
    this.addListeners();
};

// swap method called for script hot-reloading
// inherit your script state here
Logic.prototype.swap = function(old) {
    // Attributes
    this.hero = old.hero;
    this.swipePositions = old.swipePositions;
    this.swipeThreshold = old.swipeThreshold;
    this.isMouseReleaseOnEachSwipeNeeded = old.isMouseReleaseOnEachSwipeNeeded;
    this.world = old.world;
    this.worldVelocity = old.worldVelocity;

    // State
    this.vec3 = old.vec3;
    this.initialWorldLocPos = old.initialWorldLocPos;
    this.mouseDownPos = old.mouseDownPos;
    this.posIndex = old.posIndex;
    this.isInTransition = old.isInTransition;

    old.removeListeners();
    this.addListeners();
};

Logic.prototype.addListeners = function() {
    if (this.hero) {
        this.hero.findComponents("collision").map((collision) => {
            collision.on("collisionstart", this.onCollisionStart, this);
            collision.on("triggerenter", this.onCollisionStart, this);
        });
    }

    const mouse = this.app.mouse;
    let touch = this.app.touch;
    if (!touch) { // fix no shooting on some mobile // temp
        touch = this.app.touch = new pc.TouchDevice(this.app.graphicsDevice.canvas);
    }
    if (mouse) {
        mouse.on("mousemove", this.mouseMoveHandler, this);
        mouse.on("mousedown", this.mouseDownHandler, this);
        mouse.on("mouseup", this.mouseUpHandler, this);
    }
    if (touch) {
        touch.on(pc.EVENT_TOUCHMOVE, this.mouseMoveHandler, this);
        touch.on(pc.EVENT_TOUCHSTART, this.mouseDownHandler, this);
        touch.on(pc.EVENT_TOUCHEND, this.mouseUpHandler, this);
        touch.on(pc.EVENT_TOUCHCANCEL, this.mouseUpHandler, this);
    }
};
Logic.prototype.removeListeners = function() {
    if (this.hero) {
        this.hero.findComponents("collision").map((collision) => {
            collision.off("collisionstart", this.onCollisionStart, this);
            collision.off("triggerenter", this.onCollisionStart, this);
        });
    }

    const mouse = this.app.mouse;
    const touch = this.app.touch;
    if (mouse) {
        mouse.off("mousemove", this.mouseMoveHandler, this);
        mouse.off("mousedown", this.mouseDownHandler, this);
        mouse.off("mouseup", this.mouseUpHandler, this);
    }
    if (touch) {
        touch.off(pc.EVENT_TOUCHMOVE, this.mouseMoveHandler, this);
        touch.off(pc.EVENT_TOUCHSTART, this.mouseDownHandler, this);
        touch.off(pc.EVENT_TOUCHEND, this.mouseUpHandler, this);
        touch.off(pc.EVENT_TOUCHCANCEL, this.mouseUpHandler, this);
    }
};

// update code called every frame
Logic.prototype.update = function(dt) {
    // Move world
    const world = this.world;
    if (world && this.worldVelocity) {
        this.vec3.copy(this.worldVelocity).mulScalar(dt);
        world.setPosition(world.getPosition().add(this.vec3));
    }

    // 
};

// Listeners

Logic.prototype.onCollisionStart = function(arg) {
    // Reset world to the initial position
    if (this.world && !this.isInTransition) {
        // Instant move
        // this.world.setLocalPosition(this.initialWorldLocPos);

        // Tween move
        this.isInTransition = true;
        this.hero.findComponents("collision").map((collision) => {
            collision.enabled = false;
        });
        this.world.tween(this.world.getLocalPosition()).to(this.initialWorldLocPos, 1).on("complete", () => {
            this.isInTransition = false;
            this.hero.findComponents("collision").map((collision) => {
                collision.enabled = true;
            });
        }).start();
    }
};

Logic.prototype.mouseMoveHandler = function(event) {
    // Skip if mouse is up or the world is in reset transition
    if (!this.mouseDownPos || this.isInTransition) {
        return;
    }

    // Check mouse moved enough
    const pos = event.touches ? event.touches[0] : event;
    const dx = pos.x - this.mouseDownPos.x;
    if (Math.abs(dx) > this.swipeThreshold) {
        const index = this.posIndex + (dx < 0 ? -1 : 1);
        if (index >= 0 && index < this.swipePositions.length) {
            // Move to new position
            this.posIndex = index;
            if (this.isMouseReleaseOnEachSwipeNeeded) {
                this.mouseDownPos = null;
            } else {
                this.mouseDownPos = pos;
            }

            // (Tween)
            this.hero.tween(this.hero.getLocalPosition()).to(this.swipePositions[index], 1).start();
        }
    }
};
Logic.prototype.mouseDownHandler = function(event) {
    const pos = event.touches ? event.touches[0] : event;
    this.mouseDownPos = pos;
};
Logic.prototype.mouseUpHandler = function(event) {
    this.mouseDownPos = null;
};

// to learn more about script anatomy, please read:
// https://developer.playcanvas.com/en/user-manual/scripting/