class SquareController extends Component {
  speed = 50
  start() {

  }

  update() {
    //Check to see if the right arrow key is down.
    //If it is, move our character right
    if (Input.keysDown.includes("ArrowRight"))
      this.transform.position.x = this.transform.position.x + Time.deltaTime * this.speed

    //Check to see if the left arrow key is down.
    //If it is, move our character left
    if (Input.keysDown.includes("ArrowLeft"))
      this.transform.position.x = this.transform.position.x - Time.deltaTime * this.speed

  }
}
