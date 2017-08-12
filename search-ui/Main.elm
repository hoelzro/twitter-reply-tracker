port module Main exposing (main)

import Html exposing (Html, div, input, label, text, span)
import Html.Attributes exposing (id, for, property, style, type_, value)
import Html.Events exposing (onInput)
import Json.Encode

type alias Model = {
    searchQuery : String,
    searchResults : List String,
    loadingTweets : Bool
  }

type Msg =
      UpdateSearchQuery String
    | UpdateSearchResults (List String)
    | SetWidgetLoadingState Bool

port performSearch : String -> Cmd msg

port incomingSearchResults : (List String -> msg) -> Sub msg

port loadTweets : () -> Cmd msg

port tweetWidgetsLoading : (Bool -> msg) -> Sub msg

initialModel : Model
initialModel = { searchQuery = "", searchResults = [], loadingTweets = False }

init : (Model, Cmd Msg)
init = (initialModel, Cmd.none)

noCmd : Model -> (Model, Cmd msg)
noCmd model = (model, Cmd.none)

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    UpdateSearchQuery   newQuery        -> ({ model | searchQuery = newQuery }, performSearch newQuery)
    UpdateSearchResults newResults      -> ({ model | searchResults = newResults, loadingTweets = True }, loadTweets ())
    SetWidgetLoadingState loadingTweets -> noCmd <| { model | loadingTweets = loadingTweets }

subscriptions : Model -> Sub Msg
subscriptions _ = Sub.batch [
    incomingSearchResults UpdateSearchResults,
    tweetWidgetsLoading SetWidgetLoadingState
  ]

searchBar : Model -> Html Msg
searchBar { searchQuery } =
  div [] [
    label [for "q"] [ text "Search: "],
    input [id "q", type_ "text", value searchQuery, onInput UpdateSearchQuery ] []
  ]

searchResults : Model -> Html Msg
searchResults { searchResults, loadingTweets } =
  let attrs = if loadingTweets then [style [("visibility", "hidden")]] else []
  in div attrs <|
    List.map (\s -> span [property "innerHTML" <| Json.Encode.string s] []) searchResults

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
