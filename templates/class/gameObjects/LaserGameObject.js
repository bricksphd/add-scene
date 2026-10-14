class LaserGameObject extends GameObject{
    constructor(){
        super("Laser", [], "lasers")
        this.addComponent(new LaserController())
        this.addComponent(new Polygon(), {fillStyle:"red", points:Assets.triangle})
        this.transform.scale = new Vector2(.25, 1)
    }
}