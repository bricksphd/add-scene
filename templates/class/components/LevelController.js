class LevelController extends Component{
    start(){
        SceneManager.loadScene(GenericLevel, true)
    }
    update(){
        let enemyGameObject = GameObject.find("Enemy")
        if(!enemyGameObject){
            //SceneManager.nextScene = Level02
            SceneManager.loadScene(Level02)
        }
    }
}
