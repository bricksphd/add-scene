class SquareGameObject extends GameObject{
  constructor(){
    super("SquareGameObject", [], "default")
    this.addComponent(new Polygon(), {fillStyle: "red", points: Assets.square})
    this.addComponent(new SquareController())
    this.transform.scale = new Vector2(20, 20)
  }
}
