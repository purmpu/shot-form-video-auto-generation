export default function Modal({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <p className="modal-title">{message}</p>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel}>취소</button>
          <button className="modal-confirm" onClick={onConfirm}>확인</button>
        </div>
      </div>
    </div>
  )
}
