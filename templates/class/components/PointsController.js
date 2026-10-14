class PointsController extends Component{
    update(){
        this.gameObject.getComponent(TextLabel).text = Globals.points + " points"
    }
    updatePoints(delta){
        Globals.points+=delta
    }
}