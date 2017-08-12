{-
 - Twitter Reply Tracker - Tracks replies to a tweet
 - Copyright (C) 2017 Rob Hoelz
 -
 - This program is free software: you can redistribute it and/or modify
 - it under the terms of the GNU Affero General Public License as
 - published by the Free Software Foundation, either version 3 of the
 - License, or (at your option) any later version.
 -
 - This program is distributed in the hope that it will be useful,
 - but WITHOUT ANY WARRANTY; without even the implied warranty of
 - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 - GNU Affero General Public License for more details.
 -
 - You should have received a copy of the GNU Affero General Public License
 - along with this program.  If not, see <http://www.gnu.org/licenses/>.
-}
port module Main exposing (main)

import Html exposing (Html, div, input, label, text, span)
import Html.Attributes exposing (class, id, for, property, style, type_, value)
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
  div [class "row"] [
    div [class "two columns"] [ label [for "q"] [ text "Search replies: "] ],
    div [class "ten columns"] [ input [id "q", type_ "text", value searchQuery, onInput UpdateSearchQuery ] [] ]
  ]

searchResults : Model -> Html Msg
searchResults { searchResults, loadingTweets } =
  let attrs = if loadingTweets then [style [("visibility", "hidden")]] else []
  in div attrs <|
    List.map (\s -> span [property "innerHTML" <| Json.Encode.string s] []) searchResults

view : Model -> Html Msg
view model = div [class "container"] [
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
