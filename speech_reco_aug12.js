/**
 * Created by Fry on 3/29/17.
 */
const getUserMedia = require('getusermedia')
const Speech = require('@google-cloud/speech')
const path   = require('path')
const audio  = require('audio-stream')
const pcm    = require('pcm-stream')

const myPath = path.join(__dirname, '/dexter-dev-env-code.json')

const speech_inst = Speech({
    projectId: 'dexter-dev-env',
    keyFilename: myPath
})

let mediaStream = null
let recognizeStream  = null
getUserMedia({video: false, audio: true}, function (err, ms) {
    if(err){
        return console.warn("getUserMedia error")
    }
    else { mediaStream = ms }
})


function start_recognition(){
    if(!mediaStream){
        console.warn("mediaStream not ready")
        return
    }
    sr_start()
    const request = { config: { encoding: 'LINEAR16', sampleRate: 44100 },
        singleUtterance: recognize_speech_only_once,
        interimResults: false,
        verbose: true}
    recognizeStream = speech_inst.createRecognizeStream(request)
        .on('error', sr_error)
        .on('data', function (data) {
            switch (data.endpointerType) {
            case "START_OF_SPEECH":
                out("START_OF_SPEECH")
                break;
            case "END_OF_SPEECH":
                out("END_OF_SPEECH")
                set_mic_and_instructions()
                break;
            case "END_OF_UTTERANCE":
                out("END_OF_UTTERANCE")
                set_mic_and_instructions()
            case "END_OF_AUDIO":
                out("END_OF_AUDIO")
                break;
            case "ENDPOINTER_EVENT_UNSPECIFIED":
                out("ENDPOINTER_EVENT_UNSPECIFIED")
                set_mic_and_instructions()
                if(data.results.length > 0){
                    recognize_speech_last_text = data.results[0].transcript.trim() //the 2nd through nth recos start with sapce,
                      //which would be good for contnuous dictation, but bad for recognizing the ending phrase.
                      //I could get clever and allow, but see how always trimming works out in practice.
                    console.log(recognize_speech_last_text)
                    if (request.singleUtterance) {
                        sr_result(data)
                        sr_end(data) //close window
                    }
                    else {
                        sr_result(data)
                        if(recognize_speech_last_text == recognize_speech_finish_phrase){
                            sr_end(data) //close window
                        }
                        else if (!recognize_speech_click_to_talk) {
                            sr_start()
                        }
                        else { //click to talk, so destroy so we won't be listening until next click to talk
                            //window.sourceStream.destroy()
                            recognizeStream.destroy()
                        }
                    }
                }
                break;
                default:
                    shouldnt("recognize_speech ondata got unhandled endpointerType: " + data.endpointerType)
    }
            //console.log(data.endpointerType)
            //if (data.results.length > 0) console.log(data.results[0].transcript)
        })

    //let sourceStream = null
    window.sourceStream = audio(mediaStream, {
        channels: 1,
        volume: 0.8
    })
    window.sourceStream
        .pipe(pcm())
        .pipe(recognizeStream)
}

window.start_recognition = start_recognition //needed by show_window callback.

//all these vars meaningful in ui only.
var recognition = null
var recognize_speech_window_index    = null
var recognize_speech_phrase_callback = null
var recognize_speech_finish_callback = null
var recognize_speech_only_once       = null
var recognize_speech_click_to_talk   = null
var recognize_speech_last_text       = null
var recognize_speech_last_confidence = null
var recognize_speech_finish_array    = []
var recognize_speech_finish_phrase   = "finish" //set by recognize_speech ui

function sr_start() {
    let instructions
    if ( recognize_speech_only_once ) { instructions = "Speak now.<br/>Be quiet to finish.<br/>" }
    else {
        instructions = "Speak now.<br/>" +
            "Pause to let DDE process your phrase.<br/>" +
            'Say <b>' + recognize_speech_finish_phrase + '</b> to end recognition.'
    }
    set_mic_and_instructions(instructions)
}

//window.sr_start = sr_start

function sr_result(data) {
    //out('recognize_speech top of onresult');
    //recognize_speech_instructions_id.innerHTML = "Stop talking"
    recognize_speech_last_text       = data.results[0].transcript.trim() //event_to_text(event)
    recognize_speech_last_confidence = data.results[0].confidence
    recognize_speech_finish_array.push([recognize_speech_last_text, recognize_speech_last_confidence])
    //out("recognized speech: " + recognize_speech_last_text)
    if (!recognize_speech_only_once && (recognize_speech_last_text == recognize_speech_finish_phrase)){
    }
    else if(recognize_speech_phrase_callback) {
        recognize_speech_phrase_callback(
            recognize_speech_last_text,
            recognize_speech_last_confidence)
    }
}

function sr_error(data) {
    set_mic_and_instructions()
    if (is_window_shown(recognize_speech_window_index)){ //don't show this error message if the user closed the window
        out("onerror called with: " + data, "red")
    }
}

//called only when this dialog is all over. no more reco will be done.
function sr_end(data) {
    //out('recognize_speech top of onend');
    //window.sourceStream.destroy()
    recognizeStream.destroy()
    close_window(recognize_speech_window_index)
    if ((recognize_speech_last_text == recognize_speech_finish_phrase) &&
        !recognize_speech_only_once &&
         recognize_speech_finish_callback){
            recognize_speech_finish_callback(recognize_speech_finish_array)
    }

}

function set_mic_and_instructions(instructions="Don't talk"){
    if (window["recognize_speech_img_id"]) { //window is up
        var the_gif
        if (instructions == "Don't talk") { the_gif = "mic.gif" }
        else                              { the_gif = "mic-animate.gif"}
        recognize_speech_img_id.src = the_gif
        if ((instructions == "Don't talk") && recognize_speech_click_to_talk){
            instructions = "" //since the click to talk button is on the screen, it is unncesssary and confusing to have "Don't talk"  also displayed
        }
        recognize_speech_instructions_id.innerHTML = instructions
    }
}

//public
function recognize_speech_default_phrase_callback(text, confidence){
    out("text: " + text + "<br/>confidence: " + confidence.toFixed(2))
}
window.recognize_speech_default_phrase_callback = recognize_speech_default_phrase_callback

function recognize_speech({
    title="Recognize Speech", prompt="",
    only_once=true, click_to_talk=true,
    width=400, height=200, x=400, y=200,
    background_color="rgb(238, 238, 238)",
    phrase_callback=recognize_speech_default_phrase_callback,
    finish_callback=null,   //unused if only_once=true
    finish_phrase="finish" //unused if only_once=true
    }) {
    recognize_speech_phrase_callback = phrase_callback
    recognize_speech_finish_callback = finish_callback

    let click_to_talk_html = ""
    if (click_to_talk) {
        click_to_talk_html =  "<input type='button' value='Click to talk' style='margin:10px;'/><br/>"
    }
    //note: this show_window is evaled FIRST (and only) in the ui, so the phrase_callback should be a callback_number
    recognize_speech_finish_array  = []
    recognize_speech_finish_phrase = finish_phrase
    recognize_speech_only_once     = only_once
    recognize_speech_window_index =
        show_window({content: "<div>" + prompt   + "</div>" +
        click_to_talk_html +
        "<img id='recognize_speech_img_id' src='mic.gif'/>" +
        "<span id='recognize_speech_instructions_id'/>",
            title: title,
            width: width, height: height, x: x, y: y,
            background_color: background_color,
            //callback only would ever get called if there's a click-to-talk button
            callback: "window.start_recognition" //start_recognition //called from sandbox initially
        })
    recognize_speech_click_to_talk   = click_to_talk
    if (!click_to_talk) { start_recognition() }
}

window.recognize_speech = recognize_speech