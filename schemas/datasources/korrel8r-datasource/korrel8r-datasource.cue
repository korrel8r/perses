package model

kind: "Korrel8rDatasource"
spec: #direct | #proxy

#direct: close({
  directUrl: string & !=""
})

// Proxy shape will be tightened against the Perses HTTPProxy schema when
// the target Perses plugin API/version is finalized.
#proxy: close({
  proxy: {
    kind: "HTTPProxy"
    spec: {
      url: string & !=""
      ...
    }
  }
})
