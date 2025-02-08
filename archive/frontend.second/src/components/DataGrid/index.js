import React, { useMemo } from "react"
import { DataGrid as MuiDataGrid } from "@mui/x-data-grid"
import { makeStyles } from "@material-ui/core/styles"

const useStyles = makeStyles((theme) => ({
  root: {
    borderRadius: 0,
    border: 0,
  },
  cell: {
    borderBottom: "none !important",
  },
  wrapper: {
    flexGrow: 1,
  },
  columnHeader: {
    color: theme.palette.shades.jetBlack,
    textTransform: "uppercase",
    fontSize: "13px",
    // the fontWeight property was not carrying to the columnHeaderTitle component even with !important so I needed to separate it out
    "& > .MuiDataGrid-columnHeaderDraggableContainer > .MuiDataGrid-columnHeaderTitleContainer  > .MuiDataGrid-columnHeaderTitle":
      {
        fontWeight: "600",
      },
    "& > .MuiDataGrid-columnHeaderDraggableContainer > .MuiDataGrid-columnHeaderTitleContainer": {
      padding: 0,
    },
    "& > .MuiDataGrid-columnSeparator": {
      visibility: "hidden",
    },
  },
}))

const DataGrid = ({ ...props }) => {
  const classes = useStyles()

  const { columns, rows, suppressMemoization, columnDependencies = [] } = props

  const memoizedColumns = useMemo(() => {
    return columns
  }, [rows, ...columnDependencies])

  const memoizedRows = useMemo(() => {
    return rows
  }, [rows])

  return (
    <MuiDataGrid
      pageSize={15}
      {...props}
      columns={suppressMemoization ? columns : memoizedColumns}
      rows={suppressMemoization ? rows : memoizedRows}
      classes={{
        root: classes.root,
        cell: classes.cell,
        columnHeader: classes.columnHeader,
      }}
    />
  )
}

export default DataGrid
