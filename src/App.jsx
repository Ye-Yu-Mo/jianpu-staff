import React, { useState, useEffect, useRef } from 'react';
import { Upload, Music, RefreshCw, AlertCircle, ZoomIn, ZoomOut, FileAudio, ArrowRight } from 'lucide-react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { parse } from './lib/jianpu-parser.js';
import { generate } from './lib/musicxml-generator.js';

// 内置一个简单的 MusicXML 示例 (两只老虎/Frère Jacques 片段)
const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>示例曲谱：Frère Jacques</work-title>
  </work>
  <part-list>
    <score-part id="P1">
      <part-name>Voice</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;

export default function App() {
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  const [osmd, setOsmd] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1.0);
  const [fileName, setFileName] = useState('示例曲谱.xml');
  const [tab, setTab] = useState('upload'); // 'upload' | 'jianpu'
  const [jianpuText, setJianpuText] = useState('');

  // 初始化 OSMD 实例
  useEffect(() => {
    if (containerRef.current && !osmd) {
      try {
        const instance = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          drawTitle: true,
          drawSubtitle: true,
          drawComposer: true,
          drawLyricist: true,
          drawCredits: true,
          drawPartNames: true,
          fillEmptyMeasuresWithWholeRest: true,
        });
        setOsmd(instance);
      } catch (err) {
        setError('初始化渲染引擎失败: ' + err.message);
      }
    }
  }, [containerRef]);

  // 加载默认示例曲谱
  useEffect(() => {
    if (osmd) {
      loadScore(SAMPLE_XML);
    }
  }, [osmd]);

  const loadScore = async (xmlData) => {
    if (!osmd) return;
    setIsLoading(true);
    setError('');
    try {
      await osmd.load(xmlData);
      osmd.zoom = zoom;
      osmd.render();
    } catch (err) {
      console.error(err);
      setError('曲谱解析失败，请确保文件是有效的 MusicXML 格式。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => loadScore(e.target.result);
    reader.onerror = () => setError('读取文件时出错。');
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleZoom = (newZoom) => {
    if (newZoom < 0.2 || newZoom > 3.0) return;
    setZoom(newZoom);
    if (osmd) {
      osmd.zoom = newZoom;
      osmd.render();
    }
  };

  const handleLoadSample = () => {
    setFileName('示例曲谱.xml');
    setZoom(1.0);
    loadScore(SAMPLE_XML);
  };

  const handleJianpuConvert = () => {
    try {
      const score = parse(jianpuText);
      const xml = generate(score);
      setFileName('简谱转换结果');
      loadScore(xml);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-200">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <Music className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">MusicXML 在线渲染器</h1>
          </div>
          <div className="text-sm text-slate-500 hidden sm:block">基于 OpenSheetMusicDisplay</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-col gap-4 transition-all">
          {/* Tab 切换 */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setTab('upload')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'upload' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              上传 MusicXML
            </button>
            <button
              onClick={() => setTab('jianpu')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'jianpu' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              输入简谱
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {tab === 'upload' ? (
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input type="file" accept=".xml,.musicxml" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                  disabled={isLoading}
                >
                  <Upload className="w-4 h-4" />
                  上传曲谱
                </button>
                <button
                  onClick={handleLoadSample}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  恢复示例
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full sm:w-auto flex-1">
                <textarea
                  value={jianpuText}
                  onChange={(e) => setJianpuText(e.target.value)}
                  placeholder="输入简谱，例如：[4/4] [1=C] 1 2 3 4 | 5 6 7 1' |"
                  className="w-full h-24 px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
                />
                <button
                  onClick={handleJianpuConvert}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm w-fit"
                  disabled={isLoading || !jianpuText.trim()}
                >
                  <ArrowRight className="w-4 h-4" />
                  转换为五线谱
                </button>
              </div>
            )}

            {/* 缩放控制 */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 shrink-0">
              <button onClick={() => handleZoom(zoom - 0.2)} className="p-1 hover:bg-white rounded shadow-sm text-slate-600 transition-colors" title="缩小">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium w-12 text-center text-slate-700">{Math.round(zoom * 100)}%</span>
              <button onClick={() => handleZoom(zoom + 0.2)} className="p-1 hover:bg-white rounded shadow-sm text-slate-600 transition-colors" title="放大">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium">渲染出错</h3>
              <p className="text-sm mt-1 text-red-600">{error}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[60vh] flex flex-col overflow-hidden relative">
          <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 flex items-center gap-2 text-sm text-slate-600">
            <FileAudio className="w-4 h-4" />
            <span className="font-medium truncate">{fileName}</span>
            {isLoading && <span className="ml-auto text-indigo-500 text-xs font-medium animate-pulse">正在渲染...</span>}
          </div>
          <div className="p-4 md:p-8 overflow-x-auto flex-1">
            <div
              ref={containerRef}
              className={`w-full transition-opacity duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}
            ></div>
          </div>
        </div>
      </main>
    </div>
  );
}
