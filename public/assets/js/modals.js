(function initModals(global) {
  const App = global.FinanceApp = global.FinanceApp || {};

  const state = App.state;
  const store = App.store;
  const constants = App.constants;
  const format = App.format;
  const render = App.render;

  function openModal(title, html) {
    global.document.getElementById('modalTitle').textContent = title;
    global.document.getElementById('modalBody').innerHTML = html;
    global.document.getElementById('modalBackdrop').style.display = 'flex';
  }

  function closeModal() {
    global.document.getElementById('modalBackdrop').style.display = 'none';
  }

  function syncMetaThenRefresh(deps) {
    const loadMeta = deps && typeof deps.loadMetaIntoUi === 'function'
      ? deps.loadMetaIntoUi
      : () => Promise.resolve();
    const refresh = deps && typeof deps.refresh === 'function'
      ? deps.refresh
      : null;

    return Promise.resolve()
      .then(() => loadMeta())
      .then(() => (refresh ? refresh() : null));
  }

  function renderCategoryModal(deps) {
    const custom = store.loadJson(constants.CATEGORIES_KEY, []);
    const merged = [...new Set([...(state.baseCategories.length ? state.baseCategories : store.defaultCategoryList()), ...custom])];

    const rows = merged.map((name, idx) => {
      const isCustom = custom.includes(name);
      const used = Number((state.usage.categoryUsage || {})[name] || 0);
      const safeName = format.escapeHtml(name);
      return `
        <div class="list-row">
          <div>${safeName}${isCustom ? '<span class="badge user">사용자</span>' : '<span class="badge">기본</span>'}${used ? ` <small class="muted">(${used}건 사용중)</small>` : ''}</div>
          <button class="ghost" ${isCustom ? `data-cat-edit-idx="${idx}"` : 'disabled'}>수정</button>
          <button class="ghost" ${isCustom ? `data-cat-del-idx="${idx}"` : 'disabled'}>삭제</button>
        </div>
      `;
    }).join('');

    openModal('카테고리 관리', `
      <div class="inline" style="margin-bottom:10px;">
        <input id="catNewInput" placeholder="새 카테고리" />
        <button id="catAddBtn">추가</button>
      </div>
      <div id="catList">${rows || '<small>항목 없음</small>'}</div>
    `);

    global.document.getElementById('catAddBtn').onclick = () => {
      const v = global.document.getElementById('catNewInput').value.trim();
      if (!v) return;
      const list = store.loadJson(constants.CATEGORIES_KEY, []);
      if (!list.includes(v) && !state.baseCategories.includes(v)) list.push(v);
      store.saveJson(constants.CATEGORIES_KEY, list);
      syncMetaThenRefresh(deps)
        .then(() => renderCategoryModal(deps))
        .catch(error => global.alert(error.message));
    };

    global.document.getElementById('modalBody').onclick = e => {
      const delIdx = e.target.getAttribute('data-cat-del-idx');
      const editIdx = e.target.getAttribute('data-cat-edit-idx');

      if (delIdx != null) {
        const del = merged[Number(delIdx)];
        if (!del) return;
        const used = Number((state.usage.categoryUsage || {})[del] || 0);
        if (used > 0 && !global.confirm(`"${del}" 카테고리는 기존 거래 ${used}건에서 사용중입니다.\n삭제하면 기존 거래 값은 유지되고 선택 목록에서만 제거됩니다.\n계속할까요?`)) return;
        const list = store.loadJson(constants.CATEGORIES_KEY, []).filter(x => x !== del);
        store.saveJson(constants.CATEGORIES_KEY, list);
        syncMetaThenRefresh(deps)
          .then(() => renderCategoryModal(deps))
          .catch(error => global.alert(error.message));
        return;
      }

      if (editIdx != null) {
        const edit = merged[Number(editIdx)];
        if (!edit) return;
        const used = Number((state.usage.categoryUsage || {})[edit] || 0);
        if (used > 0 && !global.confirm(`"${edit}" 카테고리는 기존 거래 ${used}건에서 사용중입니다.\n이름 변경 시 기존 거래 라벨은 자동 변경되지 않습니다.\n계속할까요?`)) return;
        const next = global.prompt('카테고리 이름 수정', edit);
        if (!next || !next.trim()) return;
        const list = store.loadJson(constants.CATEGORIES_KEY, []).map(x => (x === edit ? next.trim() : x));
        store.saveJson(constants.CATEGORIES_KEY, [...new Set(list)]);
        syncMetaThenRefresh(deps)
          .then(() => renderCategoryModal(deps))
          .catch(error => global.alert(error.message));
      }
    };
  }

  function renderMethodModal(deps) {
    const custom = store.loadJson(constants.METHODS_KEY, []);
    const merged = [...new Set([...(state.baseMethods.length ? state.baseMethods : store.defaultMethodList()), ...custom])];

    const rows = merged.map((name, idx) => {
      const isCustom = custom.includes(name);
      const used = Number((state.usage.paymentMethodUsage || {})[name] || 0);
      const safeName = format.escapeHtml(name);
      return `
        <div class="list-row">
          <div>${safeName}${isCustom ? '<span class="badge user">사용자</span>' : '<span class="badge">기본</span>'}${used ? ` <small class="muted">(${used}건 사용중)</small>` : ''}</div>
          <button class="ghost" ${isCustom ? `data-method-edit-idx="${idx}"` : 'disabled'}>수정</button>
          <button class="ghost" ${isCustom ? `data-method-del-idx="${idx}"` : 'disabled'}>삭제</button>
        </div>
      `;
    }).join('');

    openModal('결제수단 관리', `
      <div class="inline" style="margin-bottom:10px;">
        <input id="methodNewInput" placeholder="새 결제수단" />
        <button id="methodAddBtn">추가</button>
      </div>
      <div id="methodList">${rows || '<small>항목 없음</small>'}</div>
    `);

    global.document.getElementById('methodAddBtn').onclick = () => {
      const v = global.document.getElementById('methodNewInput').value.trim();
      if (!v) return;
      const list = store.loadJson(constants.METHODS_KEY, []);
      if (!list.includes(v) && !state.baseMethods.includes(v)) list.push(v);
      store.saveJson(constants.METHODS_KEY, list);
      syncMetaThenRefresh(deps)
        .then(() => renderMethodModal(deps))
        .catch(error => global.alert(error.message));
    };

    global.document.getElementById('modalBody').onclick = e => {
      const delIdx = e.target.getAttribute('data-method-del-idx');
      const editIdx = e.target.getAttribute('data-method-edit-idx');

      if (delIdx != null) {
        const del = merged[Number(delIdx)];
        if (!del) return;
        const used = Number((state.usage.paymentMethodUsage || {})[del] || 0);
        if (used > 0 && !global.confirm(`"${del}" 결제수단은 기존 거래 ${used}건에서 사용중입니다.\n삭제하면 기존 거래 값은 유지되고 선택 목록에서만 제거됩니다.\n계속할까요?`)) return;
        const list = store.loadJson(constants.METHODS_KEY, []).filter(x => x !== del);
        store.saveJson(constants.METHODS_KEY, list);
        syncMetaThenRefresh(deps)
          .then(() => renderMethodModal(deps))
          .catch(error => global.alert(error.message));
        return;
      }

      if (editIdx != null) {
        const edit = merged[Number(editIdx)];
        if (!edit) return;
        const used = Number((state.usage.paymentMethodUsage || {})[edit] || 0);
        if (used > 0 && !global.confirm(`"${edit}" 결제수단은 기존 거래 ${used}건에서 사용중입니다.\n이름 변경 시 기존 거래 라벨은 자동 변경되지 않습니다.\n계속할까요?`)) return;
        const next = global.prompt('결제수단 이름 수정', edit);
        if (!next || !next.trim()) return;
        const list = store.loadJson(constants.METHODS_KEY, []).map(x => (x === edit ? next.trim() : x));
        store.saveJson(constants.METHODS_KEY, [...new Set(list)]);
        syncMetaThenRefresh(deps)
          .then(() => renderMethodModal(deps))
          .catch(error => global.alert(error.message));
      }
    };
  }

  function renderBalanceModal() {
    const accounts = store.getBalanceAccounts();
    const rows = accounts.map((a, i) => `
      <div class="list-row">
        <div>${format.escapeHtml(a.name)} <small>(${format.escapeHtml(a.currency)}, ${format.escapeHtml(a.source)})</small></div>
        <button class="ghost" data-acc-edit="${i}">수정</button>
        <button class="ghost" data-acc-del="${i}">삭제</button>
      </div>
    `).join('');

    openModal('잔고 관리', `
      <div class="filters" style="margin-bottom:10px;">
        <input id="accNameInput" placeholder="이름" />
        <select id="accCurrencyInput">
          <option value="JPY">JPY (¥)</option>
          <option value="KRW">KRW (₩)</option>
          <option value="USD">USD ($)</option>
        </select>
        <select id="accSourceInput">
          <option value="sumitomo">스미토모 데이터 연동</option>
          <option value="rakuten">라쿠텐 데이터 연동</option>
          <option value="cash">현금 데이터 연동</option>
          <option value="none">미연동(표시만)</option>
        </select>
        <button id="accAddBtn">잔고 추가</button>
      </div>
      <div>${rows || '<small>항목 없음</small>'}</div>
    `);

    global.document.getElementById('accAddBtn').onclick = () => {
      const name = global.document.getElementById('accNameInput').value.trim();
      const currency = global.document.getElementById('accCurrencyInput').value;
      const source = global.document.getElementById('accSourceInput').value;
      if (!name) return;
      const list = store.getBalanceAccounts();
      list.push({ id: `acc_${Date.now()}`, name, currency, source });
      store.setBalanceAccounts(list);
      render.applyBalanceHeaders();
      renderBalanceModal();
    };

    global.document.getElementById('modalBody').onclick = e => {
      const del = e.target.getAttribute('data-acc-del');
      const edit = e.target.getAttribute('data-acc-edit');

      if (del != null) {
        const idx = Number(del);
        const list = store.getBalanceAccounts();
        list.splice(idx, 1);
        store.setBalanceAccounts(list);
        render.applyBalanceHeaders();
        renderBalanceModal();
        return;
      }

      if (edit != null) {
        const idx = Number(edit);
        const list = store.getBalanceAccounts();
        const current = list[idx];
        if (!current) return;
        global.document.getElementById('accNameInput').value = current.name;
        global.document.getElementById('accCurrencyInput').value = current.currency;
        global.document.getElementById('accSourceInput').value = current.source;
        list.splice(idx, 1);
        store.setBalanceAccounts(list);
        render.applyBalanceHeaders();
        renderBalanceModal();
      }
    };
  }

  App.modals = {
    openModal,
    closeModal,
    renderCategoryModal,
    renderMethodModal,
    renderBalanceModal,
  };
})(typeof window !== 'undefined' ? window : globalThis);
