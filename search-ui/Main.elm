import Html exposing (Html, text)

type alias Model = ()
type alias Msg = ()

init : (Model, Cmd Msg)
init = ((), Cmd.none)

update : Msg -> Model -> (Model, Cmd Msg)
update msg model = ((), Cmd.none)

subscriptions : Model -> Sub Msg
subscriptions _ = Sub.none

view : Model -> Html Msg
view model = text "Hello"

main : Program Never Model Msg
main = Html.program {
    init = init,
    update = update,
    subscriptions = subscriptions,
    view = view
  }
