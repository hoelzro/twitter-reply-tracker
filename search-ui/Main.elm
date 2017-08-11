port module Main exposing (main)

import Html exposing (Html, div, input, label, li, text, ul)
import Html.Attributes exposing (id, for, property, type_, value)
import Html.Events exposing (onInput)
import Json.Encode

type alias Model = {
    searchQuery : String,
    searchResults : List String
  }

type Msg =
      UpdateSearchQuery String
    | UpdateSearchResults (List String)

port performSearch : String -> Cmd msg

port incomingSearchResults : (List String -> msg) -> Sub msg

initialModel : Model
initialModel = { searchQuery = "", searchResults = [] }

init : (Model, Cmd Msg)
init = (initialModel, Cmd.none)

noCmd : Model -> (Model, Cmd msg)
noCmd model = (model, Cmd.none)

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    UpdateSearchQuery   newQuery   -> ({ model | searchQuery = newQuery }, performSearch newQuery)
    UpdateSearchResults newResults -> noCmd <| { model | searchResults = newResults }

subscriptions : Model -> Sub Msg
subscriptions _ = incomingSearchResults UpdateSearchResults

searchBar : Model -> Html Msg
searchBar { searchQuery } =
  div [] [
    label [for "q"] [ text "Search: "],
    input [id "q", type_ "text", value searchQuery, onInput UpdateSearchQuery ] []
  ]

searchResults : Model -> Html Msg
searchResults { searchResults } =
  ul [] <|
    List.map (\s -> li [property "innerHTML" <| Json.Encode.string s] []) searchResults

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
