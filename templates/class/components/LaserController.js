class LaserController extends Component {
    update() {
        this.transform.position.y -= Time.deltaTime * 200

        if (this.transform.position.y < 50) {
            this.gameObject.destroy()
        }

        //Collision Check
       
        let myPosition = this.transform.position
        let enemyGameObjects = GameObject.findGameObjectsWithTag("Enemy")
        for (const enemyGameObject of enemyGameObjects) {
            let enemyPosition = enemyGameObject.transform.position
            let distance = myPosition.minus(enemyPosition).magnitude
            if (distance < 20) {
                this.gameObject.destroy()
                // enemyGameObject.destroy()
                let healthComponent = enemyGameObject.getComponent(Health)
                healthComponent.health--
                //Globals.points++
                let gameObjects = GameObject.findGameObjectsByType(Transform)
                for(const gameObject of gameObjects){
                    gameObject.broadcastMessage("updatePoints", [1])
                }
            }
        }

    }
}