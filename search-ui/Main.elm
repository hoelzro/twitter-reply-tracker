import Html exposing (Html, div, input, label, text)
import Html.Attributes exposing (id, for, type_)

type alias Model = ()
type alias Msg = ()

init : (Model, Cmd Msg)
init = ((), Cmd.none)

update : Msg -> Model -> (Model, Cmd Msg)
update msg model = ((), Cmd.none)

subscriptions : Model -> Sub Msg
subscriptions _ = Sub.none

searchBar : Model -> Html Msg
searchBar model =
  div [] [
    label [for "q"] [ text "Search: "],
    input [id "q", type_ "text"] []
  ]

searchResults : Model -> Html Msg
searchResults _ = text "results"

view : Model -> Html Msg
view model = div [] [
    searchBar model,
    searchResults model
  ]

main : Program Never Model Msg
main = Html.program {
    init = init,
    update = update,
    subscriptions = subscriptions,
    view = view
  }
