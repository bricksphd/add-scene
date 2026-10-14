class GenericLevel extends Scene{
    constructor(){
        super()
        let mainGameObject = this.instantiate(new MainGameObject(), new Vector2(50, 300))
        this.instantiate(new PointsGameObject(), new Vector2(0, 20))
        // Camera.main.backgroundColor = "cyan"

        let helperGameObject = this.instantiate(new HelperGameObject(), new Vector2(50,50))

        helperGameObject.transform.setParent(mainGameObject.transform)

        let sceneTimer = new GameObject("SceneTimer", [], "UI")
        sceneTimer.addComponent(new TextLabel(), {fillStyle:"gray", font:"30px Times"})
        sceneTimer.addComponent(new SceneTimerController())
        this.instantiate(sceneTimer, new Vector2(0, 50))


        let wrappedText = new GameObject("WrappedText", [], "UI")
        wrappedText.addComponent(new MultiLineTextLabel(), {fillStyle:"gray", text:"We the People of the United States, in Order to form a more perfect Union, establish Justice, insure domestic Tranquility, provide for the common defence, promote the general Welfare, and secure the Blessings of Liberty to ourselves and our Posterity, do ordain and establish this Constitution for the United States of America.", font:"30px Times"})
        this.instantiate(wrappedText, new Vector2(0, 100))
    }
}