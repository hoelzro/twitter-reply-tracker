import Html exposing (Html, div, input, label, text)
import Html.Attributes exposing (id, for, type_, value)
import Html.Events exposing (onInput)

type alias Model = {
    searchQuery : String
  }
type Msg =
  UpdateSearchQuery String

initialModel : Model
initialModel = { searchQuery = "" }

init : (Model, Cmd Msg)
init = (initialModel, Cmd.none)

noCmd : Model -> (Model, Cmd msg)
noCmd model = (model, Cmd.none)

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    UpdateSearchQuery newQuery -> noCmd <| { model | searchQuery = newQuery }

subscriptions : Model -> Sub Msg
subscriptions _ = Sub.none

searchBar : Model -> Html Msg
searchBar { searchQuery } =
  div [] [
    label [for "q"] [ text "Search: "],
    input [id "q", type_ "text", value searchQuery, onInput UpdateSearchQuery ] []
  ]

searchResults : Model -> Html Msg
searchResults { searchQuery } = text searchQuery

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
