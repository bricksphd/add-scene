class MainScene extends Scene{
  constructor(){
    super()
    this.instantiate(new SquareGameObject(), new Vector2(0,0), 0)
  }
}
