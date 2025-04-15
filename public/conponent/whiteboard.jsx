
import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import io from 'socket.io-client';
import jsPDF from 'jspdf';

const socket = io('http://localhost:3001');

function Whiteboard() {
  const canvasRef = useRef(null);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const canvas = new fabric.Canvas('whiteboard-canvas', {
      isDrawingMode: true
    });
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = brushSize;
    canvasRef.current = canvas;

    canvas.on('path:created', (opt) => {
      const pathData = opt.path.toObject();
      socket.emit('draw', pathData);
      setHistory(prev => [...prev, pathData]);
      setRedoStack([]);
    });

    socket.on('draw', (data) => {
      const path = new fabric.Path(data.path, data);
      canvas.add(path);
    });

    return () => canvas.dispose();
  }, [color, brushSize]);

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (canvas._objects.length > 0) {
      const last = canvas._objects.pop();
      canvas.renderAll();
      setRedoStack(prev => [...prev, last]);
    }
  };

  const handleRedo = () => {
    const canvas = canvasRef.current;
    const redoItem = redoStack.pop();
    if (redoItem) {
      canvas.add(redoItem);
      canvas.renderAll();
    }
  };

  const handleSaveAsImage = () => {
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL({ format: 'png' });
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = dataURL;
    link.click();
  };

  const handleSaveAsPDF = () => {
    const canvas = canvasRef.current;
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    pdf.addImage(imgData, 'PNG', 10, 10, 180, 160);
    pdf.save('whiteboard.pdf');
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!image) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", image);

    try {
      const response = await fetch("http://localhost:5000/predict", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setPredictions(data.predictions);
    } catch (error) {
      console.error("Prediction error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <h2 className="mb-3 text-center">Collaborative Whiteboard with Image Classification</h2>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="form-control form-control-color" />
        <select onChange={e => setBrushSize(Number(e.target.value))} className="form-select w-auto">
          {[1, 3, 5, 10, 20].map(size => <option key={size} value={size}>{size}px</option>)}
        </select>
        <button className="btn btn-warning" onClick={handleUndo}>Undo</button>
        <button className="btn btn-info" onClick={handleRedo}>Redo</button>
        <button className="btn btn-success" onClick={handleSaveAsImage}>Save as Image</button>
        <button className="btn btn-secondary" onClick={handleSaveAsPDF}>Save as PDF</button>
      </div>

      <canvas id="whiteboard-canvas" width={900} height={500} className="border rounded w-100 mb-4"></canvas>

      <div className="mb-3">
        <label className="form-label">Upload an image to classify</label>
        <input type="file" accept="image/*" onChange={handleImageChange} className="form-control" />
      </div>

      {preview && (
        <div className="mb-3">
          <img src={preview} alt="Preview" className="img-fluid rounded" />
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={loading}
        className="btn btn-primary mb-3"
      >
        {loading ? "Classifying..." : "Upload & Predict"}
      </button>

      {predictions.length > 0 && (
        <div className="card">
          <div className="card-body">
            <h5 className="card-title">Predictions</h5>
            <ul className="list-group list-group-flush">
              {predictions.map((pred, idx) => (
                <li className="list-group-item" key={idx}>
                  {pred.label} - {(pred.confidence * 100).toFixed(2)}%
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default Whiteboard;
